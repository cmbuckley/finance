const assert = require('assert');

const Adapter  = require('../src/adapter');
const MonzoTransaction = require('../src/transaction/monzo');
const TruelayerTransaction = require('../src/transaction/truelayer');

describe('Adapter', () => {
    describe('#fixTransferTimes', () => {
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

            const fixedTransactions = Adapter.fixTransferTimes(transactions);

            assert.equal(fixedTransactions.length, 2);
            assert.equal(fixedTransactions[0].getDate('YYYY-MM-DD HH:mm'), '2022-09-14 05:45');
            assert.equal(fixedTransactions[1], transactions[1]);
        });
    });
});
