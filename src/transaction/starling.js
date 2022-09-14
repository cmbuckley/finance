const Transaction = require('../transaction');

class StarlingTransaction extends Transaction {
    constructor(account, raw, adapter) {
        super(account, raw, adapter, {isMinorCurrency: true});
    }

    isValid() {
        if (this.raw.status == 'DECLINED') { return false; }
        return true;
    }

    isDebit() {
        return (this.raw.direction == 'OUT');
    }

    isCashWithdrawal() {
        return (this.raw.sourceSubType == 'ATM');
    }

    isSettled() {
        return (this.raw.status == 'SETTLED');
    }

    isForeign() {
        return (this.raw.amount.currency != this.raw.sourceAmount.currency);
    }

    _getDate() {
        return this.raw.transactionTime;
    }

    getCurrency() {
        return this.raw.sourceAmount.currency || '';
    }

    getLocalAmount() {
        return this._getAmount((this.isDebit() ? -1 : 1) * this.raw.sourceAmount.minorUnits);
    }

    getExchangeRate() {
        if (!this.isForeign()) { return 1; }
        return Math.pow(10, this._numDecimals(this.raw.sourceAmount.currency) - this._numDecimals(this.raw.amount.currency)) * this.raw.amount.minorUnits / this.raw.sourceAmount.minorUnits;
    }

    getMemo() {
        return this.raw.reference.replace(/[ \n]+/g, ' ');
    }

    getId() {
        return this.raw.feedItemUid;
    }

    getCategory() {
        return ''; // @todo
    }

    getTransfer() {
        if (this.raw.counterPartySubEntityIdentifier) {
            return this._getTransfer(this._getBank(this.raw.counterPartySubEntityIdentifier, this.raw.counterPartySubEntitySubIdentifier));
        }

        if (this.isCashWithdrawal()) {
            return this._getTransfer(this.getCurrency());
        }

        return '';
    }

    getPayee() {
        return ''; // @todo
    }
}

module.exports = StarlingTransaction;
