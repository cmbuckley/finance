const assert = require('assert');
const sinon = require('sinon');

const {DataAPIClient} = require('truelayer-client');
const moment = require('moment');
const util = require('../util');

const TruelayerAdapter = require('../../src/adapter/truelayer');

describe('TruelayerAdapter', () => {
    describe('#getTransactions', () => {
        beforeEach(function () {
            // first param gets require()d for the account map
            this.adapter = new TruelayerAdapter('assert', {}, util.logger());

            this.adapter.accountMap = {
                1111: 'Current Account',
                2222: 'Savings Account',
                3333: 'Credit Card',
            }

            sinon.stub(DataAPIClient, 'getAccounts').resolves({
                results: [{
                    account_id: '1111',
                    account_type: 'TRANSACTION',
                    display_name: 'BCM',
                }, {
                    account_id: '2222',
                    account_type: 'SAVINGS',
                    display_name: 'BCM',
                }]
            });
            this.cardStub = sinon.stub(DataAPIClient, 'getCards').resolves({
                results: [{
                    account_id: '3333',
                    card_type: 'CREDIT',
                    display_name: 'CC',
                }]
            });
        });

        afterEach(sinon.restore);

        it('should query Truelayer for accounts and cards', async function () {
            const transactionsStub = sinon.stub(DataAPIClient, 'getTransactions').resolves({results: []});
            const cardTransactionsStub = sinon.stub(DataAPIClient, 'getCardTransactions').resolves({results: []});

            const transactions = await this.adapter.getTransactions(moment(), moment());

            assert.equal(transactionsStub.callCount, 2);
            assert.equal(transactionsStub.firstCall.args[1], '1111');
            assert.equal(transactionsStub.secondCall.args[1], '2222');

            assert.equal(cardTransactionsStub.callCount, 1);
            assert.equal(cardTransactionsStub.firstCall.args[1], '3333');

            assert.equal(transactions.length, 0);
        });

        it('should get account transactions', async function () {
            const raw = {
                description: 'TEST',
                transaction_type: 'DEBIT',
                amount: -1000,
                currency: 'GBP',
                transaction_id: '12345678',
            };

            sinon.stub(DataAPIClient, 'getTransactions').resolves({results: []})
                .withArgs(undefined, '1111').resolves({results: [raw]});
            sinon.stub(DataAPIClient, 'getCardTransactions').resolves({results: []});

            const transactions = await this.adapter.getTransactions(moment(), moment());

            assert.equal(transactions.length, 1);
            assert.equal(transactions[0].constructor.name, 'TruelayerTransaction');
            assert.equal(transactions[0].getAccount(), 'Current Account');
            assert.equal(transactions[0].raw, raw);
        });

        it('should get card transactions', async function () {
            const raw = {
                description: 'DIRECT DEBIT PAYMENT',
                transaction_type: 'CREDIT',
                amount: 1000,
                currency: 'GBP',
                transaction_id: '12345678',
            };

            sinon.stub(DataAPIClient, 'getTransactions').resolves({results: []});
            sinon.stub(DataAPIClient, 'getCardTransactions').resolves({results: [raw]});

            const transactions = await this.adapter.getTransactions(moment(), moment());

            assert.equal(transactions.length, 1);
            assert.equal(transactions[0].constructor.name, 'TruelayerTransaction');
            assert.equal(transactions[0].getAccount(), 'Credit Card');
            assert.equal(transactions[0].raw, raw);
        });

        it('should handle a card error', async function () {
            // should fail silently
            this.cardStub.rejects('nope');

            sinon.stub(DataAPIClient, 'getTransactions').resolves({results: []})
            const transactions = await this.adapter.getTransactions(moment(), moment());

            assert.deepEqual(transactions, []);
        });
    });
});
