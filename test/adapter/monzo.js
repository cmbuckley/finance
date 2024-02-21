const assert = require('assert');
const sinon = require('sinon');

const monzo = require('monzo-bank');
const util = require('../util');

const MonzoAdapter = require('../../src/adapter/monzo');

describe('MonzoAdapter', () => {
    describe('#getTransactions', () => {
        afterEach(sinon.restore);

        it('should query monzo for transactions', async () => {
            const adapter = new MonzoAdapter('', {}, util.logger());

            adapter.token = 'test_token'; // fake login
            adapter.addConfig({
                account: 'uk_retail',
                name: 'Monzo Current',
                module: 'mc',
            });

            const accountsStub = sinon.stub(monzo, 'accounts').resolves({
                accounts: [{
                    id: 'acc_123',
                    type: 'uk_retail',
                    display_name: 'Current',
                }, {
                    id: 'acc_456',
                    type: 'uk_prepaid',
                    description: 'Prepaid',
                }]
            });

            sinon.stub(monzo, 'pots').resolves({pots: []});

            const raw = {
                account_id: 'acc_123',
                amount: -1000,
                category: 'groceries',
                created: '2022-09-05T02:10:52.578Z',
                currency: 'GBP',
                description: 'TEST',
                id: 'tx_1234567890',
                local_amount: -1000,
                local_currency: 'GBP',
                notes: '',
                settled: '2022-09-05T02:10:52.578Z',
                updated: '2022-09-05T02:13:26.436Z',
            };

            const transactionsStub = sinon.stub(monzo, 'transactions').resolves({
                transactions: [raw]
            });

            const transactions = await adapter.getTransactions(new Date(), new Date());

            assert(accountsStub.calledOnce);
            assert(transactionsStub.calledOnce);
            assert(transactionsStub.calledWith(sinon.match({
                account_id: 'acc_123',
            }), 'test_token'));

            assert.equal(transactions.length, 1);
            assert.equal(transactions[0].constructor.name, 'MonzoTransaction');
            assert.equal(transactions[0].getAccount(), 'Monzo Current');
            assert.equal(transactions[0].raw, raw);
        });

        it('should make multiple calls when exceeding the limit', async () => {
            const adapter = new MonzoAdapter('', {}, util.logger());

            adapter.addConfig({
                account: 'uk_retail',
                name: 'Monzo Current',
                module: 'mc',
            });

            sinon.stub(monzo, 'accounts').resolves({
                accounts: [{type: 'uk_retail'}]
            });
            sinon.stub(monzo, 'pots').resolves({pots: []});

            const transactionsStub = sinon.stub(monzo, 'transactions');
            transactionsStub.onFirstCall().resolves({
                transactions: Array.from({length: 100}, (x, i) => ({
                    id: 'tx_' + (i + 1)
                })),
            });
            transactionsStub.onSecondCall().resolves({
                transactions: Array.from({length: 5}, () => ({})),
            });

            const transactions = await adapter.getTransactions(new Date(), new Date());

            assert.equal(transactions.length, 105);
            assert(transactionsStub.secondCall.calledWithMatch({since: 'tx_100'}));
        });

        it('should throw accounts error', async () => {
            const adapter = new MonzoAdapter();
            const accountsStub = sinon.stub(monzo, 'accounts').rejects({error: {code: 'nope'}});
            assert.rejects(adapter.getTransactions(), {code: 'nope'});
        });

        it('should throw verification required transactions error', async () => {
            const adapter = new MonzoAdapter();

            sinon.stub(monzo, 'accounts').resolves({
                accounts: [{type: 'uk_retail'}]
            });
            sinon.stub(monzo, 'pots').resolves({pots: []});
            sinon.stub(monzo, 'transactions').rejects({error: {
                code: 'forbidden.verification_required',
            }});

            assert.rejects(adapter.getTransactions(), 'Cannot query older transactions - please refresh permissions in the Monzo app');
        });

        it('should throw transactions error', async () => {
            const adapter = new MonzoAdapter();

            sinon.stub(monzo, 'accounts').resolves({
                accounts: [{type: 'uk_retail'}]
            });
            sinon.stub(monzo, 'pots').resolves({pots: []});
            sinon.stub(monzo, 'transactions').rejects({error: {
                code: 'something_else',
            }});

            assert.rejects(adapter.getTransactions(), {code: 'something_else'});
        });
    });

    describe('#toJSON', () => {
        it('should return user and pots', () => {
            const adapter = new MonzoAdapter('', {
                token: {user_id: 'user_123'},
            }, {});

            adapter.pots = {
                pot_123: {
                    name: 'Pot 123',
                    round_up: false,
                    other_key: 'ignored',
                },
                pot_456: {
                    name: 'Round Up',
                    round_up: true,
                    other_key: 'Irrelevant',
                },
            };

            assert.deepEqual(adapter.toJSON(), {
                user: 'user_123',
                pots: {
                    pot_123: {
                        name: 'Pot 123',
                        round_up: false,
                    },
                    pot_456: {
                        name: 'Round Up',
                        round_up: true,
                    },
                },
            });
        });
    });
});
