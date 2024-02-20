const assert = require('assert');
const sinon = require('sinon');

const fs = require('fs').promises;
const origReadFile = fs.readFile;

const LoadAdapter = require('../../src/adapter/load');

function fakeFile(data) {
    sinon.stub(fs, 'readFile').callsFake(origReadFile).withArgs('load.json').resolves(JSON.stringify(data));
}

describe('LoadAdapter', () => {
    afterEach(sinon.restore);

    describe('#getTransactions', () => {
        it('should set up the transactions', async () => {
            const childSpy = sinon.spy();

            const adapter = new LoadAdapter('load.json', {
                child: childSpy,
            });

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

            const transactions = await adapter.getTransactions();

            assert(childSpy.calledOnce);
            assert(childSpy.calledWith({module: 'testmodule'}))

            assert.equal(transactions.length, 1);
            assert.equal(transactions[0].constructor.name, 'MonzoTransaction');
            assert.equal(transactions[0].getAccount(), 'Monzo Current');
            assert.equal(transactions[0].getMemo(), 'TESTING');
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
