const assert = require('assert');

const Transaction = require('../../src/transaction/truelayer');
const fixture = require('../../src/exporter/csv');

describe('CSV exporter', () => {
    it('should export transactions', (done) => {
        const transactions = [new Transaction('HSBC', {
            transaction_id: '12345',
            transaction_type: 'DEBIT',
            transaction_classification: ['Shopping', 'Groceries'],
            currency: 'GBP',
            timestamp: '2022-01-01',
            amount: '4.20',
            description: 'Testing',
        }, {}, {})];

        fixture(transactions, {}, (err, csv) => {
            const expected = [
                'Account,Date,Payee,Amount,Category,Currency,Rate,Notes,Number',
                'HSBC,2022-01-01,,-4.20,Food:Groceries,GBP,1,Testing,12345',
            ].join('\n') + '\n';

            assert.ifError(err);
            assert.equal(csv, expected);
            done();
        });
    });

    it('should export transfers', (done) => {
        const transactions = [new Transaction('HSBC', {
            transaction_id: '12345',
            transaction_type: 'DEBIT',
            transaction_classification: ['Uncategorized', 'Cash & ATM'],
            currency: 'GBP',
            timestamp: '2022-01-01',
            amount: '100',
            description: 'CASH UK ATM 01JAN',
        }, {}, {})];

        fixture(transactions, {}, (err, csv) => {
            const expected = [
                'Account,Date,Payee,Amount,Category,Currency,Rate,Notes,Number',
                'HSBC,2022-01-01,,-100.00,Transfer to:Cash,GBP,1,CASH UK ATM 01JAN,12345',
            ].join('\n') + '\n';

            assert.ifError(err);
            assert.equal(csv, expected);
            done();
        });
    });
});
