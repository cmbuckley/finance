const assert = require('assert');

const MonzoTransaction = require('../../src/transaction/monzo');

describe('MonzoTransaction', () => {
    describe('domestic transaction', () => {
        it('should parse raw data', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                account_id: 'acc_12345',
                amount: -2381,
                categories: {
                    groceries: -2381
                },
                category: 'groceries',
                counterparty: {},
                created: '2022-09-05T02:10:52.578Z',
                currency: 'GBP',
                description: 'WAITROSE LEEDS GBR',
                id: 'tx_1234567890',
                local_amount: -2381,
                local_currency: 'GBP',
                merchant: {
                    category: 'groceries',
                    group_id: 'grp_67890',
                    id: 'merch_12345',
                    name: 'Waitrose & Partners',
                },
                metadata: {},
                notes: '',
                settled: '2022-09-05T02:10:52.578Z',
                updated: '2022-09-05T02:13:26.436Z',
            }, {
                data: {
                    transfers: {},
                    payees: {
                        merch_12345: 'Waitrose Meanwood',
                    }
                }
            });

            assert(transaction.isValid());
            assert(transaction.isDebit());
            assert(!transaction.isCashWithdrawal());
            assert(transaction.isSettled());
            assert(!transaction.isForeign());

            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm', 'Europe/London'), '2022-09-05 03:10');
            assert.equal(transaction.getCurrency(), 'GBP');
            assert.equal(transaction.getLocalAmount(), '-23.81');
            assert.equal(transaction.getExchangeRate(), 1);
            assert.equal(transaction.getMemo(), 'WAITROSE LEEDS GBR');
            assert.equal(transaction.getId(), 'tx_1234567890');
            assert.equal(transaction.getCategory(), 'Food:Groceries');
            assert(!transaction.getTransfer());
            assert.equal(transaction.getPayee(), 'Waitrose Meanwood');
        });

        it('should ignore declined transactions', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                decline_reason: 'INSUFFICIENT_FUNDS',
            });

            assert(!transaction.isValid());
        });
    });

    describe('foreign transaction', () => {
        it('should get the exchange rate', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                amount: -1223,
                local_amount: -1409,
                local_currency: 'usd',
            });

            assert.equal(transaction.getExchangeRate(), 1223/1409);
        });
    });

    describe('transfer', () => {
        it('should use bank account details', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                counterparty: {
                    sort_code: '123456',
                    account_number: '12345678',
                }
            }, {
                data: {
                    transfers: {
                        '12-34-56 12345678': 'Current Account'
                    }
                }
            });

            assert.equal(transaction.getTransfer(), 'Current Account');
        });

        it('should use account ID', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                counterparty: {
                    account_id: 'acc_12345',
                }
            }, {
                data: {
                    transfers: {
                        'acc_12345': 'Monzo Joint'
                    }
                }
            });

            assert.equal(transaction.getTransfer(), 'Monzo Joint');
        });

        it('should use merchant group ID', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                merchant: {
                    group_id: 'grp_12345',
                }
            }, {
                data: {
                    transfers: {
                        'grp_12345': 'PayPal'
                    }
                }
            });

            assert.equal(transaction.getTransfer(), 'PayPal');
        });

        it('should use cash withdrawal', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                local_currency: 'GBP',
                merchant: {
                    atm: true,
                }
            }, {
                data: {
                    transfers: {
                        'GBP': 'Cash'
                    }
                }
            });

            assert.equal(transaction.getTransfer(), 'Cash');
        });

        it('should use pots', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                metadata: { pot_id: 'pot_123' },
                scheme: 'uk_retail_pot',
                amount: 1000,
            }, {
                pots: {
                    pot_123: {name: 'Savings'}
                }
            });

            assert.equal(transaction.getTransfer(), 'Monzo Savings');
        });
    });

    describe('#getMemo', () => {
        it('should label pot withdrawals', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                metadata: { pot_id: 'pot_123' },
                scheme: 'uk_retail_pot',
                amount: 1000,
            }, {
                pots: {
                    pot_123: {name: 'Savings'}
                }
            });

            assert.equal(transaction.getMemo(), 'Withdrew from Savings');
        });
    });

    describe('#toJSON', () => {
        it('should return name and module', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                amount: 1234,
            }, {}, {}, {module: 'mc'});

            assert.deepEqual(transaction.toJSON(), {
                account: 'Monzo Current',
                raw: {amount: 1234},
                module: 'mc',
            });
        });
    });
});
