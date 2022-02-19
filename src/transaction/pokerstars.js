const Transaction = require('../transaction');

class PokerStarsTransaction extends Transaction {
    constructor(raw, adapter) {
        super(account, raw, adapter);
    }

    isValid() {
    }

    isFee() {
    }

    isDebit() {
    }

    getDate(format) {
    }

    getCurrency() {
    }

    _numDecimals(currency) {
    }

    getLocalAmount() {
    }

    getExchangeRate() {
    }

    getMemo() {
    }

    getId() {
    }

    getCategory() {
    }

    getTransfer() {
    }

    getPayee() {
    }
}

module.exports = PokerStarsTransaction;
