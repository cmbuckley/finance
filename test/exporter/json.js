const assert = require('assert');

const MonzoAdapter = require('../../src/adapter/monzo');
const MonzoTransaction = require('../../src/transaction/monzo');

const fixture = require('../../src/exporter/json');

describe('JSON exporter', () => {
    it('should export monzo adapter config', async () => {
        const monzoAdapter = new MonzoAdapter('', {
            token: {user_id: 'user_123'},
        });

        const raw = {
            category: 'groceries',
            counterparty: {},
            created: '2022-01-01T07:56:11.987Z',
            currency: 'GBP',
            description: 'TESTING',
            id: 'tx_1234567890',
            local_amount: -420,
            local_currency: 'GBP',
            merchant: {},
            metadata: {},
            notes: 'Testing',
        };

        const transactions = [new MonzoTransaction('Monzo Current', raw, monzoAdapter, {}, {
            module: 'testmodule',
        })];

        const output = await fixture(transactions, {});

        assert.equal(output, JSON.stringify({
            adapters: {
                monzo: {pots: {}, user: 'user_123'}
            },
            transactions: [{
                type: 'monzo',
                account: 'Monzo Current',
                raw,
                module: 'testmodule',
            }],
        }, null, 2));
    });
});
