const moment = require('moment-timezone'),
    decimalExceptions = {JPY: 0, BTC: 8, NAN: 5};

class Transaction {
    constructor(account, raw, adapter, transactionOptions) {
        this.account = account;
        this.raw = raw;
        this.adapter = adapter;
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

    _getTransfer(key) {
        return this.adapter.data.transfers[key] || '';
    }

    _getBank(sortCode, account) {
        return sortCode.match(/\d{2}/g).join('-') + ' ' + account;
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
