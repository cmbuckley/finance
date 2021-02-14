const Transaction = require('../transaction');

const accountMap = {
    NANO: {name: 'Nano', currency: 'BTC'}, // temp until Money supports Nano
    XXBT: {name: 'Bitcoin', currency: 'BTC'},
    XXDG: {name: 'Dogecoin', currency: 'DOGE'},
};

function getAccount(asset) {
    // map fiat currencies to separate accounts
    if (asset[0] == 'Z') {
        return 'Kraken (' + asset.slice(1) + ')';
    }

    return accountMap[asset] ? accountMap[asset].name : asset;
}

function getCurrency(asset) {
    if (asset[0] == 'Z') {
        return asset.slice(1);
    }

    return accountMap[asset] ? accountMap[asset].currency : asset;
}

class KrakenTransaction extends Transaction {
    constructor(raw, adapter, logger) {
        super(getAccount(raw.asset), raw, adapter);
        this.logger = logger;
    }

    isValid() {
        // we only need to include the debit side of the trade
        return (this.isFee() || this.isDebit() || this.raw.type == 'deposit');
    }

    isFee() {
        return this.raw.type == 'fee';
    }

    isDebit() {
        return this.raw.amount < 0;
    }

    getDate(format) {
        return this._getDate(this.raw.time * 1000, format);
    }

    getCurrency() {
        // use the currency of the destination amount in a trade
        return getCurrency(!this.isFee() && this.raw.trade ? this.raw.trade.asset : this.raw.asset);
    }

    getLocalAmount() {
        let amount = this.raw.amount;

        if (this.isFee()) {
            amount = -this.raw.fee;
        } else if (this.raw.trade) {
            amount = -this.raw.trade.amount;
        }

        return this._getAmount(parseFloat(amount));
    }

    getExchangeRate() {
        if (!this.isFee() && this.raw.trade) {
            return -parseFloat(this.raw.amount) / parseFloat(this.raw.trade.amount);
        }

        return 1;
    }

    getMemo() {
        if (this.isFee()) { return 'Trade fee'; }
    }

    getId() {
        return this.raw.id;
    }

    getCategory() {
        if (this.isFee()) {
            return 'Bank Charges:Service Charge';
        }
    }

    getTransfer() {
        if (!this.isFee() && this.raw.trade) {
            return getAccount(this.raw.trade.asset);
        }
    }

    getPayee() {
        if (this.isFee()) {
            return 'Kraken';
        }
    }
}

module.exports = KrakenTransaction;
