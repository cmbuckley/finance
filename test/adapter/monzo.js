const assert = require('assert');

const MonzoAdapter = require('../../src/adapter/monzo');

describe('MonzoAdapter', () => {
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
