const assert = require('assert');
const sinon = require('sinon');
const moment = require('moment');

const fs = require('fs').promises;
const origReadFile = fs.readFile;

const LoadAdapter = require('../../src/adapter/load');
const logger = {
    child: () => {
        return {silly: () => {}}
    },
};

// setup fs to read a fake single file
function fakeFile(data) {
    sinon.stub(fs, 'lstat').resolves({isFile: () => true});
    sinon.stub(fs, 'readFile').callsFake(origReadFile).withArgs('load.json').resolves(JSON.stringify(data));
}

// setup fs to read a fake nested directory structure
function fakeStore(spec) {
    const lstatStub = sinon.stub(fs, 'lstat');
    const readdirStub = sinon.stub(fs, 'readdir');
    const readFileStub = sinon.stub(fs, 'readFile').callsFake(origReadFile);

    lstatStub.withArgs('db').resolves({isFile: () => false, isDirectory: () => true});
    readdirStub.withArgs('db').resolves(Object.keys(spec));
    readFileStub.withArgs('db/adapters.json').resolves("{}");

    for (const [account, years] of Object.entries(spec)) {
        lstatStub.withArgs('db/' + account).resolves({isDirectory: () => true});
        readdirStub.withArgs('db/' + account).resolves(Object.keys(years));

        for (const [year, transactions] of Object.entries(years)) {
            readFileStub.withArgs(`db/${account}/${year}`).resolves(JSON.stringify(transactions));
        }
    }
}

describe('LoadAdapter', () => {
    afterEach(sinon.restore);

    describe('#getTransactions', () => {
        describe('from dump file', () => {
            it('should set up the transactions', async () => {
                sinon.spy(logger, 'child');

                const adapter = new LoadAdapter('load.json', logger);

                fakeFile({
                    adapters: {
                        monzo: {pots: {}, user: 'user_123'}
                    },
                    transactions: [{
                        type: 'monzo',
                        account: 'Monzo Current',
                        raw: {
                            category: 'groceries',
                            counterparty: {},
                            created: '2022-01-01T07:56:11.987Z',
                            local_currency: 'GBP',
                            description: 'TESTING',
                        },
                        module: 'testmodule',
                    }]
                });

                const transactions = await adapter.getTransactions(moment('2022-01-01'), moment('2022-01-02'));

                assert(logger.child.calledOnce);
                assert(logger.child.calledWith({module: 'testmodule'}))

                assert.equal(transactions.length, 1);
                assert.equal(transactions[0].constructor.name, 'MonzoTransaction');
                assert.equal(transactions[0].getAccount(), 'Monzo Current');
                assert.equal(transactions[0].getMemo(), 'TESTING');
            });

            it('should filter transactions by date', async () => {
                const adapter = new LoadAdapter('load.json', logger);

                fakeFile({
                    adapters: {
                        monzo: {pots: {}, user: 'user_123'}
                    },
                    transactions: [{
                        type: 'monzo',
                        account: 'Monzo Current',
                        raw: {
                            category: 'groceries',
                            counterparty: {},
                            created: '2022-01-01T07:56:11.987Z',
                            local_currency: 'GBP',
                            description: 'TESTING',
                        },
                        module: 'testmodule',
                    }, {
                        type: 'monzo',
                        account: 'Monzo Current',
                        raw: {
                            category: 'transport',
                            counterparty: {},
                            created: '2022-01-02T09:13:17.383Z',
                            local_currency: 'GBP',
                            description: 'TESTING 2',
                        },
                        module: 'testmodule',
                    }]
                });

                const transactions = await adapter.getTransactions(moment('2022-01-02'), moment('2022-01-03'));
                assert.equal(transactions.length, 1);
                assert.equal(transactions[0].getMemo(), 'TESTING 2');
            });

            it('should filter transactions by account', async () => {
                const adapter = new LoadAdapter('load.json', logger, {account: ['fd']});

                fakeFile({
                    adapters: {
                        monzo: {pots: {}, user: 'user_123'}
                    },
                    transactions: [{
                        type: 'monzo',
                        account: 'Monzo Current',
                        raw: {
                            category: 'groceries',
                            counterparty: {},
                            created: '2022-01-02T07:56:11.987Z',
                            local_currency: 'GBP',
                            description: 'TESTING',
                        },
                        module: 'mc',
                    }, {
                        type: 'truelayer',
                        account: 'Joint Account',
                        raw: {
                            timestamp: '2022-01-02T10:20:30Z',
                            description: 'TEST 2',
                        },
                        module: 'fd',
                    }]
                });

                const transactions = await adapter.getTransactions(moment('2022-01-02'), moment('2022-01-03'));
                assert.equal(transactions.length, 1);
                assert.equal(transactions[0].getAccount(), 'Joint Account');
            });

            it('should use an inclusive date range', async () => {
                const adapter = new LoadAdapter('load.json', logger);

                fakeFile({
                    adapters: {},
                    transactions: [{
                        type: 'truelayer',
                        account: 'Credit Card',
                        raw: {
                            timestamp: '2024-09-05T00:00:00Z',
                        },
                        module: 'hsbc',
                    }]
                });

                const transactions = await adapter.getTransactions(moment('2024-09-05'), moment('2024-09-06'));
                assert.equal(transactions.length, 1);
            });
        });

        describe('from store directory', () => {
            it('should set up the transactions', async () => {
                const adapter = new LoadAdapter('db', logger);

                fakeStore({
                    hsbc: {
                        '2024.json': {
                            'txn-12345': {
                                type: 'truelayer',
                                account: 'Credit Card',
                                raw: {
                                    timestamp: '2024-01-01T00:00:00Z',
                                    description: 'TEST',
                                },
                                module: 'hsbc',
                            },
                        },
                    },
                    fd: {
                        '2023.json': {
                            'txn-12345': {
                                type: 'truelayer',
                                account: 'Joint Account',
                                raw: {
                                    timestamp: '2023-06-01T00:00:00Z',
                                    description: 'TEST 2',
                                },
                                module: 'fd',
                            },
                        },
                    },
                });

                const transactions = await adapter.getTransactions(moment('2023-01-01'), moment('2024-01-03'));

                assert.equal(transactions.length, 2);
                assert.equal(transactions[0].getMemo(), 'TEST');
                assert.equal(transactions[1].getMemo(), 'TEST 2');
            });

            it('should filter transactions by account', async () => {
                const adapter = new LoadAdapter('db', logger, {account: ['fd']});

                fakeStore({
                    hsbc: {
                        '2024.json': {
                            'txn-12345': {
                                type: 'truelayer',
                                account: 'Credit Card',
                                raw: {
                                    timestamp: '2024-01-01T00:00:00Z',
                                    description: 'TEST',
                                },
                                module: 'hsbc',
                            },
                        },
                    },
                    fd: {
                        '2023.json': {
                            'txn-12345': {
                                type: 'truelayer',
                                account: 'Joint Account',
                                raw: {
                                    timestamp: '2023-06-01T00:00:00Z',
                                    description: 'TEST 2',
                                },
                                module: 'fd',
                            },
                        },
                    },
                });

                const transactions = await adapter.getTransactions(moment('2023-01-01'), moment('2024-01-03'));

                assert.equal(transactions.length, 1);
                assert.equal(transactions[0].getMemo(), 'TEST 2');
            });
        });
    });

    describe('#delegate', () => {
        it('should mimic a Monzo adapter', async () => {
            const adapter = new LoadAdapter('load.json', {
                child: sinon.stub(),
            });

            fakeFile({
                adapters: {
                    monzo: {pots: {}, user: 'user_123'}
                },
                transactions: [],
            });

            await adapter.getTransactions();
            const monzo = adapter.delegate('monzo');

            assert.equal(monzo.getUser(), 'user_123');
        });
    });
});
