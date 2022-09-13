const assert = require('assert');

const TruelayerTransaction = require('../../src/transaction/truelayer');

describe('TruelayerTransaction', () => {
    describe('domestic transaction', () => {
        it('should parse raw data', () => {
            const transaction = new TruelayerTransaction('First Direct', {
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
            assert.equal(transaction.getId(), 'abcdef0123');
            assert.equal(transaction.getCategory(), 'Bills:TV Licence');
            assert(!transaction.getTransfer());
        });
    });

    describe('transfer', () => {
        it('should use description', () => {
            const transaction = new TruelayerTransaction('First Direct', {
                amount: 1200,
                description: 'BUCKLEY CM Bills',
                transaction_type: 'CREDIT',
            });

            assert.equal(transaction.getTransfer(), 'Current Account');
        });
    });
});
