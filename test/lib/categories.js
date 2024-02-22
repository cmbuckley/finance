const assert = require('assert');

const {search} = require('../../src/lib/categories');

describe('Categories search', () => {
    describe('Monzo transaction', () => {
        it('should lookup simple category', () => {
            const raw = {category: 'groceries'};
            assert.equal(search(raw), 'Food:Groceries');
        });

        it('should lookup using merchant Foursquare category', () => {
            const raw = {
                category: 'entertainment',
                merchant: {metadata: {foursquare_category: 'Zoo'}},
            }
            assert.equal(search(raw), 'Leisure:Activities');
        });

        it('should lookup using merchant category', () => {
            const raw = {
                category: 'eating_out',
                merchant: {category: 'Fast Food Restaurant'},
            }
            assert.equal(search(raw), 'Food:Takeaway');
        });

        it('should lookup using description', () => {
            const raw = {
                category: 'personal_care',
                description: 'CONTACT LENSES',
            };
            assert.equal(search(raw), 'Healthcare:Eyecare');
        });

        it('should support nested lookups and string default', () => {
            const raw = {
                category: 'personal_care',
                description: 'NOTHING MATCHES',
            };
            assert.equal(search(raw), 'Personal Care');
        });

        it('should lookup using nested keys', () => {
            const raw = {
                category: 'personal_care',
                counterparty: {name: 'Mental Health Services'},
            };
            assert.equal(search(raw), 'Healthcare');
        });
    });

    describe('Truelayer transaction', () => {
        it('should lookup using classification', () => {
            const raw = {
                transaction_classification: ['Personal Care', 'Hair'],
            };
            assert.equal(search(raw), 'Personal Care:Hair');
        });

        it('should lookup using category', () => {
            const raw = {
                transaction_category: 'INTEREST',
            };
            assert.equal(search(raw), 'Bank Charges:Interest');
        });

        it('should lookup using description', () => {
            const raw = {
                description: 'TV LICENCE',
            };
            assert.equal(search(raw), 'Bills:TV Licence');
        });
    });
});
