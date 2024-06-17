const assert = require('assert');
const sinon = require('sinon');

const axios = require('axios');
const moment = require('moment');
const util = require('../util');

const PayPalAdapter = require('../../src/adapter/paypal');

describe('PayPalAdapter', () => {
    describe('#getTransactions', () => {
        afterEach(sinon.restore);

        it('should query PayPal for transactions', async () => {
            const adapter = new PayPalAdapter('', {}, util.logger());

            const raw = {
                transaction_info: {
                    transaction_status: 'S',
                    transaction_event_code: 'T0006',
                    transaction_amount: {
                        currency_code: 'GBP',
                        value: '-123.45'
                    },
                },
            };

            const apiStub = sinon.stub().resolves({
                data: {transaction_details: [raw]},
            });
            sinon.stub(axios, 'create').returns({get: apiStub});

            const transactions = await adapter.getTransactions(moment(), moment());

            assert(apiStub.calledOnce);
            sinon.assert.match(apiStub.firstCall.args[1], {
                params: {transaction_status: 'S'},
            });
            assert.equal(transactions.length, 1);
            assert.equal(transactions[0].constructor.name, 'PayPalTransaction');
            assert.equal(transactions[0].raw, raw);
        });

        it('should make multiple queries for a large date range', async () => {
            const adapter = new PayPalAdapter('', {}, util.logger());

            const apiStub = sinon.stub().resolves({
                data: {transaction_details: [{}]},
            });
            sinon.stub(axios, 'create').returns({get: apiStub});

            const transactions = await adapter.getTransactions(moment('2024-01-01'), moment('2024-02-15'));

            assert(apiStub.calledTwice);
            sinon.assert.match(apiStub.firstCall.args[1], {
                params: {
                    start_date: '2024-01-01T00:00:00.000Z',
                    end_date: '2024-01-30T23:59:59.000Z',
                },
            });
            sinon.assert.match(apiStub.secondCall.args[1], {
                params: {
                    start_date: '2024-01-31T00:00:00.000Z',
                    end_date: '2024-02-15T00:00:00.000Z',
                },
            });
        });

        it('should collate conversions', async () => {
            const adapter = new PayPalAdapter('', {}, util.logger());

            const apiStub = sinon.stub().resolves({
                data: {transaction_details: [{
                    transaction_info: {
                        transaction_id: 'abc123',
                        transaction_status: 'S',
                        transaction_event_code: 'T0006',
                        transaction_amount: {currency_code: 'USD', value: '-100.00'},
                    },
                }, {
                    transaction_info: {
                        transaction_id: 'def456',
                        paypal_reference_id: 'abc123',
                        transaction_status: 'S',
                        transaction_event_code: 'T0200',
                        transaction_amount: {currency_code: 'USD', value: '100.00'},
                    },
                }, {
                    transaction_info: {
                        transaction_id: 'ghi789',
                        paypal_reference_id: 'abc123',
                        transaction_status: 'S',
                        transaction_event_code: 'T0200',
                        transaction_amount: {currency_code: 'GBP', value: '-85.00'},
                    },
                }, {
                    transaction_info: {
                        transaction_id: 'jkl012',
                        paypal_reference_id: 'abc123',
                        transaction_status: 'S',
                        transaction_event_code: 'T0700',
                        transaction_amount: {currency_code: 'GBP', value: '85.00'},
                    },
                }]},
            });

            sinon.stub(axios, 'create').returns({get: apiStub});

            const transactions = await adapter.getTransactions(moment(), moment());
            assert.equal(transactions.length, 4);
            assert.equal(transactions.filter(t => t.isValid()).length, 2);
            assert.equal(transactions[0].getLocalAmount(), -100);
            assert.equal(transactions[0].getExchangeRate(), 0.85);
        });

        it('should throw the error from the API', () => {
            const adapter = new PayPalAdapter('', {}, util.logger());

            const apiStub = sinon.stub().rejects({
                response: {data: {message: 'Invalid request'}},
            });
            sinon.stub(axios, 'create').returns({get: apiStub});

            assert.rejects(adapter.getTransactions(moment(), moment()), 'Invalid request');
        });
    });
});
