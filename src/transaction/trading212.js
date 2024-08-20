const Transaction = require('../transaction');

module.exports = class Trading212Transaction extends Transaction {

    isValid() {
        return !!this.raw.mainInfo.context.amount;
    }

    isDebit() {
        return !this.raw.mainInfo.context.applyPositiveSign;
    }

    isCashWithdrawal() {
        return false;
    }

    isSettled() {
        return true;
    }

    isForeign() {
        return this.getCurrency() !== 'GBP';
    }

    _getDate() {
        return this.raw.date;
    }

    getCurrency() {
        return this.raw.mainInfo.context.currency;
    }

    getLocalAmount() {
        return this.raw.mainInfo.context.amount;
    }

    getMemo() {
        return {
            'history.interest-on-cash.heading': 'Interest on cash',
        }[this.raw.heading.key] || '';
    }

    getId() {
        return this.raw.detailsPath.split('/')[2];
    }

    _getCategory() {
        return {
            'history.interest-on-cash.heading': 'Bank Charges:Interest',
        }[this.raw.heading.key] || '';
    }

    getTransfer() {
    }

    getPayee() {
        return 'Trading 212';
    }
}
