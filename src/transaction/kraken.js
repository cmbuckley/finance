const Transaction = require('../transaction');

const accountMap = {
    XXBT: {name: 'Bitcoin', currency: 'BTC', symbol: '₿'},
    XXDG: {name: 'Dogecoin', currency: 'DOGE', symbol: 'Ð'},

    //  temp 3-letter code until Money supports these currencies
    NANO: {name: 'Nano', currency: 'NAD', symbol: '𝑁'},
    XXLM: {name: 'Lumen', currency: 'MNT', symbol: '*'},
    ATOM: {name: 'Cosmos', currency: 'AZN', symbol: '⚛'},
    XTZ:  {name: 'Tezos', currency: 'TZS', symbol: 'ꜩ'},
};

function getAccount(asset) {
    // map fiat currencies to separate accounts
    if (asset[0] == 'Z') {
        return 'Kraken (' + asset.slice(1) + ')';
    }

    if (accountMap[asset]) {
        return accountMap[asset].name;
    }
}

function getCurrency(asset) {
    if (asset[0] == 'Z') {
        return asset.slice(1);
    }

    return accountMap[asset] ? accountMap[asset].currency : asset;
}

// nice formatting for a currency amount
function getDisplayAmount(amount, asset) {
    if (asset[0] == 'Z') {
        return amount.toLocaleString('en', {
            style: 'currency',
            currency: asset.slice(1),
            maximumFractionDigits: 5,
        });
    }

    return (accountMap[asset] ? accountMap[asset].symbol : (asset + ' '))
        + amount.toLocaleString('en', {minimumFractionDigits: 0, maximumFractionDigits: 5});
}

class KrakenTransaction extends Transaction {
    constructor(raw, adapter) {
        let account = getAccount(raw.asset);
        super(account || raw.asset, raw, adapter);

        if (!account) {
            this.adapter.logger.warn('Unrecognised asset', {asset: raw.asset});
        }
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

    // e.g. USD is displayed in 2DP, but balances are 4DP
    _numDecimals(currency) {
        return super._numDecimals(currency) + 2;
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
        if (this.raw.trade) {
            let buy = (this.raw.asset[0] == 'Z'),
                which = (buy ? this.raw.trade : this.raw),
                other = (buy ? this.raw : this.raw.trade),
                price = (buy ? this.getExchangeRate() : (1 / this.getExchangeRate()));

            if (which.asset[0] == 'Z') { return 'Currency Conversion'; }

            return (buy ? 'Buy ' : 'Sell ') + getDisplayAmount(Math.abs(which.amount), which.asset)
                + ' @ ' + getDisplayAmount(price, other.asset);
        }
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
