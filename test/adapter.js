const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const util = require('./util');
const Adapter = require('../src/adapter');
const AuthClient = require('../src/lib/auth');
const MonzoTransaction = require('../src/transaction/monzo');
const TruelayerTransaction = require('../src/transaction/truelayer');

function getProxyAdapter(stubs) {
    // set the correct path for our stubs and add some default stubs
    stubs = Object.entries(stubs).reduce((acc, [mod, stub]) => {
        const modulePath = path.dirname(require.resolve('../src/adapter')) + `/../config/${mod}.json`;
        acc[modulePath] = stub;
        return acc;
    }, {
        './lib/auth': {},
        'monzo-bank': {},
        'truelayer-client': {},
    });

    // add the @noCallThru & @runtimeGlobal directives for all the modules
    return proxyquire('../src/adapter', Object.entries(stubs).reduce((acc, [mod, stub]) => {
        stub['@runtimeGlobal'] = true;
        stub['@noCallThru'] = true;
        acc[mod] = stub;
        return acc;
    }, {}));
}

describe('Adapter', () => {
    describe('#login', () => {
        afterEach(sinon.restore);

        it('gets the token from the auth client', async () => {
            const adapter = new Adapter('assert', {
                grantType: 'client_credentials',
                credentials: {
                    client: {id: 'i', secret: 's'},
                    auth: {tokenHost: 'https://foo'},
                },
            });

            const loginStub = sinon.stub(AuthClient.prototype, 'login').returns({
                token: {access_token: 'abc123'},
            });

            await adapter.login({foo: 'bar'});

            assert.equal(adapter.getAccessToken(), 'abc123');
            assert(loginStub.calledOnce);
            assert(loginStub.calledWith({foo: 'bar'}));
        });
    });

    describe('getAll', () => {
        it('should create requested adapters', async function () {
            const ProxyAdapter = getProxyAdapter({
                mc:   {type: 'monzo'},
                hsbc: {type: 'truelayer'},
                monzo:     {redirect_uri: 'https://callback/monzo'},
                truelayer: {redirect_uri: 'https://callback/truelayer'},
            });

            const adapters = ProxyAdapter.getAll(['mc', 'hsbc'], util.logger());

            assert.equal(adapters.length, 2);
            assert.equal(adapters[0].constructor.name, 'MonzoAdapter');
            assert.equal(adapters[0].getConfig().redirect_uri, 'https://callback/monzo');
            const accountMap = Object.values(adapters[0].accountMap);
            assert.equal(accountMap.length, 1);
            assert.equal(accountMap[0].module, 'mc');
            assert.equal(adapters[1].constructor.name, 'TruelayerAdapter');
            assert.equal(adapters[1].getConfig().redirect_uri, 'https://callback/truelayer');
        });

        it('should create a load adapter', () => {
            const adapters = Adapter.getAll('dump.json');

            assert.equal(adapters.length, 1);
            assert.equal(adapters[0].constructor.name, 'LoadAdapter');
            assert.equal(adapters[0].file, 'dump.json');
        });

        it('should create separate config objects', () => {
            const ProxyAdapter = getProxyAdapter({
                hsbc: {type: 'truelayer'},
                fd:   {type: 'truelayer'},
                truelayer: {redirect_uri: 'https://callback/truelayer'},
            });

            const adapters = ProxyAdapter.getAll(['fd', 'hsbc'], util.logger());
            assert.equal(adapters[0].getConfig().module, 'fd');
            assert.equal(adapters[1].getConfig().module, 'hsbc');
        });
    });

    describe('detectTransfers', () => {
        it('should set time on transfers', () => {
            const transactions = [
                new TruelayerTransaction('Joint Account', {
                    amount: -5,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'MONZO TEST',
                    transaction_type: 'DEBIT',
                }),
                new MonzoTransaction('Monzo Current', {
                    created: '2022-09-14T05:45:34.000Z',
                    local_amount: 500,
                    local_currency: 'GBP',
                    counterparty: {
                       sort_code: '123456',
                       account_number: '12345678',
                    },
                }, {data: {transfers: {
                    '12-34-56 12345678': 'Joint Account',
                }}})
            ];

            assert.equal(transactions[0].getDate('YYYY-MM-DD HH:mm'), '2022-09-14');

            const fixedTransactions = Adapter.detectTransfers(transactions);

            assert.equal(fixedTransactions.length, 2);
            assert.equal(fixedTransactions[0].getDate('YYYY-MM-DD HH:mm'), '2022-09-14 05:45');
            assert.equal(fixedTransactions[1], transactions[1]);
        });

        it('should deal with date boundaries', () => {
            const transactions = [
                new TruelayerTransaction('Joint Account', {
                    amount: -5,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'MONZO TEST',
                    transaction_type: 'DEBIT',
                }),
                new MonzoTransaction('Monzo Current', {
                    created: '2022-09-14T00:20:18.000+01:00',
                    local_amount: 500,
                    local_currency: 'GBP',
                    counterparty: {
                       sort_code: '123456',
                       account_number: '12345678',
                    },
                }, {data: {transfers: {
                    '12-34-56 12345678': 'Joint Account',
                }}})
            ];

            assert.equal(transactions[0].getDate('YYYY-MM-DD HH:mm'), '2022-09-14');

            const timezone = 'Europe/London';
            const fixedTransactions = Adapter.detectTransfers(transactions, timezone);

            assert.equal(fixedTransactions.length, 2);
            assert.equal(fixedTransactions[0].getDate('YYYY-MM-DD HH:mm', timezone), '2022-09-14 00:20');
            assert.equal(fixedTransactions[1], transactions[1]);
        });

        it('should detect a transfer', () => {
            const transactions = [
                new TruelayerTransaction('Current Account', {
                    amount: 100,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'TEST',
                    transaction_type: 'CREDIT',
                }),
                new MonzoTransaction('Monzo Current', {
                    id: 'TEST',
                    local_amount: -10000,
                    local_currency: 'GBP',
                    amount: -10000,
                    currency: 'GBP',
                    created: '2022-09-14T10:00:00Z',
                    description: 'Sending money',
                    settled: true,
                    counterparty: {
                        sort_code: '123456',
                        account_number: '12345678',
                    },
                }, {
                    data: {
                        transfers: {
                            '12-34-56 12345678': 'Current Account'
                        }
                    }
                }),
            ];

            assert.equal(transactions[0].getTransfer(), undefined);
            assert.equal(transactions[1].getTransfer(), 'Current Account');
            const fixedTransactions = Adapter.detectTransfers(transactions);
            assert.equal(fixedTransactions[0].getTransfer(), 'Monzo Current');
            assert.equal(fixedTransactions[1].getTransfer(), 'Current Account');
        });

        it('should not transfer to the wrong account', () => {
            const transactions = [
                new TruelayerTransaction('Current Account', {
                    amount: -100,
                    currency: 'GBP',
                    timestamp: '2022-09-14T00:00:00Z',
                    description: 'LYP ISA TRANSFER',
                    transaction_type: 'DEBIT',
                }),
                new TruelayerTransaction('Current Account', {
                    amount: 100,
                    currency: 'GBP',
                    timestamp: '2022-09-14T10:00:00Z',
                    description: 'FOR ISA',
                    transaction_type: 'CREDIT',
                }),
            ];

            assert.equal(transactions[0].getTransfer(), 'HSBC ISA');
            assert.equal(transactions[1].getTransfer(), undefined);
            const fixedTransactions = Adapter.detectTransfers(transactions);
            assert.equal(fixedTransactions[1].getTransfer(), undefined);
        });
    });
});
