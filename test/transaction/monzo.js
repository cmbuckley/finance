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

    describe('#getLocalAmount', () => {
        [['GBP', 12345, '123.45'],
         ['EUR', 12345, '123.45'],
         ['JPY', 12345, '12345'],
        ].forEach(([currency, amount, expected]) => {
            it(`should properly output ${currency} amount`, () => {
                const transaction = new MonzoTransaction('Monzo Current', {
                    local_amount: amount,
                    local_currency: currency,
                });

                assert.equal(transaction.getLocalAmount(), expected);
            });
        });
    });

    describe('#getPayee', () => {
        it('should use user_id', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                counterparty: {
                    user_id: 'user_1234'
                }
            }, {
                data: {
                    payees: {
                        'user_1234': 'Monzo Payee'
                    }
                }
            });

            assert.equal(transaction.getPayee(), 'Monzo Payee');
        });

        it('should use bank account details', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                counterparty: {
                    user_id: 'anon_1234',
                    sort_code: '123456',
                    account_number: '12345678',
                }
            }, {
                data: {
                    payees: {
                        '12-34-56 12345678': 'Bank Payee'
                    }
                }
            });

            assert.equal(transaction.getPayee(), 'Bank Payee');
        });

        it('should use merchant details', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                merchant: {
                    id: 'merch_1234',
                }
            }, {
                data: {
                    payees: {
                        'merch_1234': 'Waitrose'
                    }
                }
            });

            assert.equal(transaction.getPayee(), 'Waitrose');
        });

        it('should use merchant group details', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                merchant: {
                    id: 'merch_1234',
                    group_id: 'grp_1234',
                }
            }, {
                data: {
                    payees: {
                        'grp_1234': 'Boots'
                    }
                }
            });

            assert.equal(transaction.getPayee(), 'Boots');
        });

        it('should return empty for a PayPal transfer', () => {
            const transaction = new MonzoTransaction('Monzo Current', {
                user_id: 'user_1234',
                merchant: {
                    id: 'merch_1234',
                    group_id: 'grp_1234',
                }
            }, {
                getUser: () => 'user_1234',
                data: {
                    transfers: {
                        'grp_1234': 'PayPal'
                    }
                }
            });

            assert.equal(transaction.getPayee(), '');
        });
    });

    describe('#getTransfer', () => {
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
                },
                user_id: 'user_123',
            }, {
                data: {
                    transfers: {
                        'grp_12345': 'PayPal'
                    }
                },
                getUser: () => 'user_123',
            });

            assert.equal(transaction.getTransfer(), 'PayPal');
        });

        it('should not denote a transaction by another user as a PayPal transfer', () => {
            const transaction = new MonzoTransaction('Monzo Joint', {
                merchant: {
                    group_id: 'grp_12345',
                },
                user_id: 'user_456',
                local_amount: -100,
            }, {
                data: {
                    transfers: {
                        'grp_12345': 'PayPal'
                    }
                },
                getUser: () => 'user_123',
            });

            assert.equal(transaction.getTransfer(), '');
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
                type: 'monzo',
                account: 'Monzo Current',
                raw: {amount: 1234},
                module: 'mc',
            });
        });
    });
});
