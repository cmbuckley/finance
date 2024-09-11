const assert = require('assert');

const TruelayerTransaction = require('../../src/transaction/truelayer');

describe('TruelayerTransaction', () => {
    describe('domestic transaction', () => {
        it('should parse raw data', () => {
            const transaction = new TruelayerTransaction('Joint Account', {
                amount: -13.37,
                currency: 'GBP',
                description: 'TV LICENCE MBP',
                merchant_name: 'Tv Licensing',
                meta: {
                    provider_category: 'DD',
                    provider_id: '1234567890',
                    provider_reference: 'TV LICENCE MBP',
                    transaction_type: 'Debit'
                },
                normalised_provider_transaction_id: 'txn-987654321',
                provider_transaction_id: 'uryewnoriuyfnosdiufynaosdiu',
                timestamp: '2022-09-01T00:00:00Z',
                transaction_category: 'DIRECT_DEBIT',
                transaction_classification: ['Bills and Utilities', 'Television'],
                transaction_id: 'abcdef0123',
                transaction_type: 'DEBIT'
            });

            assert(transaction.isValid());
            assert(transaction.isDebit());
            assert(!transaction.isCashWithdrawal());
            assert(transaction.isSettled());
            assert(!transaction.isForeign());

            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm'), '2022-09-01');
            assert.equal(transaction.getCurrency(), 'GBP');
            assert.equal(transaction.getLocalAmount(), '-13.37');
            assert.equal(transaction.getExchangeRate(), 1);
            assert.equal(transaction.getMemo(), 'TV LICENCE MBP');
            assert.equal(transaction.getId(), 'txn-987654321');
            assert.equal(transaction.getCategory(), 'Bills:TV Licence');
            assert(!transaction.getTransfer());
        });

        it('should output time if present', () => {
            const transaction = new TruelayerTransaction('Joint Account', {
                timestamp: '2022-09-01T00:00:00Z',
            });

            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm'), '2022-09-01');
            transaction.getDate().set({hour: 1, minute: 2, second: 3});
            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm'), '2022-09-01 01:02');
        });
    });

    describe('foreign transaction', () => {
        it('should detect foreign currencies in descriptions', () => {
            const transaction = new TruelayerTransaction('Joint Account', {
                amount: -68.94,
                currency: 'GBP',
                description: 'BASE BACKPACKERS SYDNEY AUD 102.00 @ 1.4795',
                transaction_id: 'abcdef0123',
                transaction_type: 'DEBIT'
            });

            assert.equal(transaction.getCurrency(), 'AUD');
            assert.equal(transaction.getLocalAmount(), '-102.00');
            assert.equal(transaction.getExchangeRate(), 102 / 68.94);
        });
    });

    describe('#getTransfer', () => {
        it('should use description', () => {
            const transaction = new TruelayerTransaction('Joint Account', {
                amount: 1200,
                description: 'BUCKLEY CM Bills',
                transaction_type: 'CREDIT',
            });

            assert.equal(transaction.getTransfer(), 'Current Account');
        });
    });

    describe('#toJSON', () => {
        it('should return name and module', () => {
            const transaction = new TruelayerTransaction('Current Account', {
                amount: 1234,
            }, {
                getConfig: () => ({module: 'hsbc'})
            });

            assert.deepEqual(transaction.toJSON(), {
                type: 'truelayer',
                account: 'Current Account',
                raw: {amount: 1234},
                module: 'hsbc',
            });
        });
    });
});
