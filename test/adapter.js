const assert = require('assert');

const Adapter  = require('../src/adapter');
const MonzoTransaction = require('../src/transaction/monzo');
const TruelayerTransaction = require('../src/transaction/truelayer');

describe('Adapter', () => {
    describe('#detectTransfers', () => {
        it('should set time on transfers', () => {
            const transactions = [
                new TruelayerTransaction('First Direct', {
                    amount: -5,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'MONZO TEST',
                    transaction_type: 'DEBIT',
                }),
                new MonzoTransaction('Monzo Current', {
                    created: '2022-09-14T05:45:34.000Z',
                    local_amount: 500,
                    local_currency: 'GBP',
                    counterparty: {
                       sort_code: '123456',
                       account_number: '12345678',
                    },
                }, {data: {transfers: {
                    '12-34-56 12345678': 'First Direct',
                }}})
            ];

            assert.equal(transactions[0].getDate('YYYY-MM-DD HH:mm'), '2022-09-14');

            const fixedTransactions = Adapter.detectTransfers(transactions);

            assert.equal(fixedTransactions.length, 2);
            assert.equal(fixedTransactions[0].getDate('YYYY-MM-DD HH:mm'), '2022-09-14 05:45');
            assert.equal(fixedTransactions[1], transactions[1]);
        });

        it('should deal with date boundaries', () => {
            const transactions = [
                new TruelayerTransaction('First Direct', {
                    amount: -5,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'MONZO TEST',
                    transaction_type: 'DEBIT',
                }),
                new MonzoTransaction('Monzo Current', {
                    created: '2022-09-14T00:20:18.000+01:00',
                    local_amount: 500,
                    local_currency: 'GBP',
                    counterparty: {
                       sort_code: '123456',
                       account_number: '12345678',
                    },
                }, {data: {transfers: {
                    '12-34-56 12345678': 'First Direct',
                }}})
            ];

            assert.equal(transactions[0].getDate('YYYY-MM-DD HH:mm'), '2022-09-14');

            const timezone = 'Europe/London';
            const fixedTransactions = Adapter.detectTransfers(transactions, timezone);

            assert.equal(fixedTransactions.length, 2);
            assert.equal(fixedTransactions[0].getDate('YYYY-MM-DD HH:mm', timezone), '2022-09-14 00:20');
            assert.equal(fixedTransactions[1], transactions[1]);
        });

        it('should detect a transfer', () => {
            const transactions = [
                new TruelayerTransaction('Current Account', {
                    amount: 100,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'TEST',
                    transaction_type: 'CREDIT',
                }),
                new MonzoTransaction('Monzo Current', {
                    id: 'TEST',
                    local_amount: -10000,
                    local_currency: 'GBP',
                    amount: -10000,
                    currency: 'GBP',
                    created: '2022-09-14T10:00:00Z',
                    description: 'Sending money',
                    settled: true,
                    counterparty: {
                        sort_code: '123456',
                        account_number: '12345678',
                    },
                }, {
                    data: {
                        transfers: {
                            '12-34-56 12345678': 'Current Account'
                        }
                    }
                }),
            ];

            assert.equal(transactions[0].getTransfer(), undefined);
            assert.equal(transactions[1].getTransfer(), 'Current Account');
            const fixedTransactions = Adapter.detectTransfers(transactions);
            assert.equal(fixedTransactions[0].getTransfer(), 'Monzo Current');
            assert.equal(fixedTransactions[1].getTransfer(), 'Current Account');
        });

        it('should not transfer to the wrong account', () => {
            const transactions = [
                new TruelayerTransaction('Current Account', {
                    amount: -100,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'LYP ISA TRANSFER',
                    transaction_type: 'DEBIT',
                }),
                new TruelayerTransaction('Current Account', {
                    amount: 100,
                    currency: 'GBP',
                    timestamp: '2022-09-14T10:00:00Z',
                    description: 'FOR ISA',
                    transaction_type: 'CREDIT',
                }),
            ];

            assert.equal(transactions[0].getTransfer(), 'ISA');
            assert.equal(transactions[1].getTransfer(), undefined);
            const fixedTransactions = Adapter.detectTransfers(transactions);
            assert.equal(fixedTransactions[1].getTransfer(), undefined);
        });
    });
});
