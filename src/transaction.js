const moment = require('moment-timezone'),
    decimalExceptions = {JPY: 0};

class Transaction {
    constructor(account, raw, transactionOptions) {
        this.account = account;
        this.raw = raw;
        this._options = transactionOptions || {};
    }

    _getDate(value, format) {
        return moment(value).tz('Europe/London').format(format);
    }

    _numDecimals(currency) {
        return (decimalExceptions.hasOwnProperty(currency) ? decimalExceptions[currency] : 2);
    }

    _getAmount(amount) {
        let decimals = this._numDecimals(this.getCurrency());

        if (this._options.isMinorCurrency) {
            amount = amount / Math.pow(10, decimals);
        }

        return amount.toFixed(decimals);
    }

    getAccount() {
        return this.account;
    }

    isValid() {
        return true;
    }

    isTransfer() {
        return !!this.getTransfer();
    }

    toJSON() {
        return {account: this.account, raw: this.raw};
    }
}

module.exports = Transaction;
