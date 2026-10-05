const assert = require('assert');

const {search} = require('../../src/lib/categories');

describe('Categories search', () => {
    describe('Monzo transaction', () => {
        it('looks up simple category', () => {
            const raw = {category: 'groceries'};
            assert.equal(search(raw), 'Food:Groceries');
        });

        it('looks up using merchant Foursquare category', () => {
            const raw = {
                category: 'entertainment',
                merchant: {metadata: {foursquare_category: 'Zoo'}},
            }
            assert.equal(search(raw), 'Leisure:Activities');
        });

        it('looks up using merchant category', () => {
            const raw = {
                category: 'eating_out',
                merchant: {category: 'Fast Food Restaurant'},
            }
            assert.equal(search(raw), 'Food:Takeaway');
        });

        it('looks up using description', () => {
            const raw = {
                category: 'personal_care',
                description: 'CONTACT LENSES',
            };
            assert.equal(search(raw), 'Healthcare:Eyecare');
        });

        it('supports nested lookups and string default', () => {
            const raw = {
                category: 'personal_care',
                description: 'NOTHING MATCHES',
            };
            assert.equal(search(raw), 'Personal Care');
        });

        it('looks up using nested keys', () => {
            const raw = {
                category: 'personal_care',
                counterparty: {name: 'Mental Health Services'},
            };
            assert.equal(search(raw), 'Healthcare');
        });
    });

    describe('Truelayer transaction', () => {
        it('looks up using classification', () => {
            const raw = {
                transaction_classification: ['Personal Care', 'Hair'],
            };
            assert.equal(search(raw), 'Personal Care:Hair');
        });

        it('looks up using category', () => {
            const raw = {
                transaction_category: 'INTEREST',
            };
            assert.equal(search(raw), 'Income:Interest');
        });

        it('looks up using description', () => {
            const raw = {
                description: 'TV LICENCE',
            };
            assert.equal(search(raw), 'Bills:TV Licence');
        });
    });
});
