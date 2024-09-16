const assert = require('assert');

const TruelayerTransaction = require('../../src/transaction/truelayer');
const fixture = require('../../src/exporter/qif');

describe('QIF exporter', () => {
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

        const qif = await fixture(transactions, {});
        const expected = `
            !Account
            NHSBC
            TBank
            ^
            !Type:Bank
            D2022-01-01
            T-4.20
            MTesting
            P
            LFood:Groceries
            Ntxn-12345
            ^
        `.replace(/^ +/gm, '').trim();

        assert.equal(qif, expected);
    });
    0

    it('should export transfers', async () => {
        const data = {transfers: {patterns: {
            'Current Account': 'CURR ACC',
            'Joint Account': 'JOINT ACC',
        }}};

        const transactions = [
            new TruelayerTransaction('Current Account', {
                normalised_provider_transaction_id: 'txn-12345',
                transaction_type: 'DEBIT',
                transaction_classification: [],
                currency: 'GBP',
                timestamp: '2022-01-01',
                amount: '100',
                description: 'JOINT ACCOUNT Bills',
            }, {data}, {}),
            new TruelayerTransaction('Joint Account', {
                normalised_provider_transaction_id: 'txn-54321',
                transaction_type: 'CREDIT',
                transaction_classification: [],
                currency: 'GBP',
                timestamp: '2022-01-01',
                amount: '100',
                description: 'CURR ACC Bills',
            }, {data}, {}),
        ];

        const qif = await fixture(transactions, {});
        const expected = `
            !Account
            NCurrent Account
            TBank
            ^
            !Type:Bank
            D2022-01-01
            T-100.00
            MJOINT ACCOUNT Bills
            P
            L[Joint Account]
            Ntxn-12345
            ^
            !Account
            NJoint Account
            TBank
            ^
            !Type:Bank
            D2022-01-01
            T100.00
            MCURR ACC Bills
            P
            L[Current Account]
            Ntxn-54321
            ^
        `.replace(/^ +/gm, '').trim();

        assert.equal(qif, expected);
    });
});
