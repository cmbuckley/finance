const moment = require('moment-timezone'),
    categories = require('./lib/categories'),
    decimalExceptions = {JPY: 0, BTC: 8, NAN: 5};

class Transaction {
    #date;
    _transfer;

    constructor(account, raw, adapter, logger, transactionOptions) {
        this.account = account;
        this.raw = raw;
        this.adapter = adapter;
        this.logger = logger;
        this._options = transactionOptions || {};
    }

    getModule() {
        return this.adapter.getConfig().module;
    }

    getDate(format, timezone) {
        let date = this.#date || this._parseDate();
        if (timezone) { date = date.tz(timezone); }
        return (format ? date.format(format) : date);
    }

    _parseDate() {
        let value = this._getDate(),
            format, timezone;

        if (value?.value) {
            ({value, format, timezone} = value);
        }

        this.#date = (timezone ? moment.tz(value, format, timezone) : moment(value, format)).utc();
        return this.#date;
    }

    _getDate() {
    }

    _numDecimals(currency) {
        return decimalExceptions[currency] ?? 2;
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

    getCategory() {
        let category = categories.search(this.raw);
        if (category) { return category; }

        // ignore ATM withdrawals and transfers
        if (this.isCashWithdrawal() || this.isTransfer()) {
            return '';
        }

        return this._getCategory();
    }

    _getCategory() {
        return '';
    }

    getAccount() {
        return this.account;
    }

    isValid() {
        return true;
    }

    isCashWithdrawal() {
        return false;
    }

    isTransfer() {
        return !!this.getTransfer();
    }

    getTransfer() {
    }

    setTransfer(transfer) {
        this._transfer = transfer;
    }

    toJSON() {
        return {
            type:    this.constructor.name.replace('Transaction', '').toLowerCase(),
            account: this.account,
            raw:     this.raw,
            module:  this.getModule(),
        };
    }
}

module.exports = Transaction;
