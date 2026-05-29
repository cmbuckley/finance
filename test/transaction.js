const assert = require('assert');

const Transaction = require('../src/transaction');

class StubTransaction extends Transaction {
    #dateStub;

    constructor(date) {
        super();
        this.#dateStub = date;
    }

    _getDate() {
        return this.#dateStub;
    }
}

describe('Transaction', () => {
    describe('#getDate', () => {
        it('outputs time if present', () => {
            const transaction = new StubTransaction('2022-09-01T00:00:00Z');

            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm'), '2022-09-01');
            transaction.getDate().set({hour: 1, minute: 2, second: 3});
            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm'), '2022-09-01 01:02');
        });

        it('handles lone dates', () => {
            const transaction = new StubTransaction({
                value: '27/05/2026',
                format: 'DD/MM/YYYY',
            });
            assert.equal(transaction.getDate('YYYY-MM-DD HH:mm'), '2026-05-27');
        });
    });
});
