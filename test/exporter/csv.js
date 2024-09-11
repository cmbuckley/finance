const assert = require('assert');

const MonzoTransaction = require('../../src/transaction/monzo');
const TruelayerTransaction = require('../../src/transaction/truelayer');
const fixture = require('../../src/exporter/csv');

describe('CSV exporter', () => {
    it('should export transactions', async () => {
        const transactions = [new TruelayerTransaction('HSBC', {
            normalised_provider_transaction_id: 'txn-12345',
            transaction_type: 'DEBIT',
            transaction_classification: ['Shopping', 'Groceries'],
            currency: 'GBP',
            timestamp: '2022-01-01',
            amount: '4.20',
            description: 'Testing',
        }, {}, {})];

        const csv = await fixture(transactions, {});
        const expected = [
            'Account,Date,Payee,Amount,Category,Currency,Rate,Notes,Number',
            'HSBC,2022-01-01,,-4.20,Food:Groceries,GBP,1,Testing,txn-12345',
        ].join('\n') + '\n';

        assert.equal(csv, expected);
    });

    it('should export times', async () => {
        const transactions = [new MonzoTransaction('Monzo Current', {
            category: 'groceries',
            counterparty: {},
            created: '2022-01-01T07:56:11.987Z',
            currency: 'GBP',
            description: 'TESTING',
            id: 'tx_1234567890',
            local_amount: -420,
            local_currency: 'GBP',
            merchant: {},
            metadata: {},
            notes: 'Testing',
        }, {data: {transfers: {}}}, {})];

        const csv = await fixture(transactions, {});
        const expected = [
            'Account,Date,Payee,Amount,Category,Currency,Rate,Notes,Number',
            'Monzo Current,2022-01-01 07:56,,-4.20,Food:Groceries,GBP,1,Testing,tx_1234567890',
        ].join('\n') + '\n';

        assert.equal(csv, expected);
    });

    it('should export transfers', async () => {
        const transactions = [new TruelayerTransaction('HSBC', {
            normalised_provider_transaction_id: 'txn-12345',
            transaction_type: 'DEBIT',
            transaction_classification: ['Uncategorized', 'Cash & ATM'],
            currency: 'GBP',
            timestamp: '2022-01-01',
            amount: '100',
            description: 'CASH UK ATM 01JAN',
        }, {}, {})];

        const csv = await fixture(transactions, {});
        const expected = [
            'Account,Date,Payee,Amount,Category,Currency,Rate,Notes,Number',
            'HSBC,2022-01-01,,-100.00,Transfer to:Cash,GBP,1,CASH UK ATM 01JAN,txn-12345',
        ].join('\n') + '\n';

        assert.equal(csv, expected);
    });
});
