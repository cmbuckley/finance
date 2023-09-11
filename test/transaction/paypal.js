const assert = require('assert');

const PayPalTransaction = require('../../src/transaction/paypal');

describe('PayPalTransaction', () => {
    describe('transaction', () => {
        it('should parse raw data', () => {
            const transaction = new PayPalTransaction('PayPal', {
                payer_info: {
                    account_id: 'U123456789',
                },
                transaction_info: {
                    transaction_amount: {
                        currency_code: 'GBP',
                        value: '-137.50'
                    },
                    transaction_event_code: 'T1107',
                    transaction_id: '53718408C2495003B',
                    transaction_note: 'Jumper',
                    transaction_initiation_date: '2023-07-10T14:47:53+0000',
                    transaction_status: 'S',
                }
            }, {
                data: {
                    transfers: {},
                    payees: {
                        U123456789: 'Test Payee',
                    }
                }
            });

            assert(transaction.isValid());
            assert(transaction.isDebit());
            assert(!transaction.isCashWithdrawal());

            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm', 'Europe/London'), '2023-07-10 15:47');
            assert.equal(transaction.getCurrency(), 'GBP');
            assert.equal(transaction.getLocalAmount(), '-137.50');
            assert.equal(transaction.getMemo(), 'Jumper');
            assert.equal(transaction.getId(), '53718408C2495003B');
            assert.equal(transaction.getPayee(), 'Test Payee');
        });

        it('should ignore invalid transactions', () => {
            const transaction = new PayPalTransaction('PayPal', {
                transaction_info: {
                    transaction_status: 'D',
                },
            });

            assert(!transaction.isValid());
        });

        it('should use transaction note', () => {
            const transaction = new PayPalTransaction('PayPal', {
                transaction_info: {
                    transaction_note: 'Transaction note',
                    transaction_subject: 'Transaction subject',
                },
            });

            assert.equal(transaction.getMemo(), 'Transaction note');
        });

        it('should use description of single cart item', () => {
            const transaction = new PayPalTransaction('PayPal', {
                cart_info: {
                    item_details: [{
                        item_name: 'Cart item',
                    }],
                },
                transaction_info: {
                    transaction_subject: 'Transaction subject',
                },
            });

            assert.equal(transaction.getMemo(), 'Cart item');
        });
    });
});