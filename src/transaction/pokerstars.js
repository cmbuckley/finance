const Transaction = require('../transaction');
const defaultCurrency = 'GBP';
const fileTimezone = 'America/Toronto';

class PokerStarsTransaction extends Transaction {

    isValid() {
        if (this.raw.Amount == 0) { return false; }

        if (this.isTransfer()) {
            // only include the debit side, except for transfers to default account where we always want the non-default side
            return (this.raw.Currency == defaultCurrency || (this.isDebit() && this.raw.transfer.Currency != defaultCurrency));
        }

        return true;
    }

    isDebit() {
        return (this.raw.Amount < 0);
    }

    _getDate() {
        return {
            value:    this.raw.DateTime,
            format:   'YYYY/MM/DD h:mm A',
            timezone: fileTimezone,
        };
    }

    /*
     * Transfer from GBP to other: always in the foreign currency
     * Transfer from other to GBP: always in the foreign currency
     * Transfer between 2 non-GBP accounts: always in the crediting currency
     */
    getCurrency() {
        if (!this.raw.transfer) { return this.raw.Currency; }
        if (this.raw.Currency == defaultCurrency) { return this.raw.transfer.Currency; }
        if (this.raw.transfer.Currency == defaultCurrency) { return this.raw.Currency; }

        return (this.isDebit() ? this.raw.transfer.Currency : this.raw.Currency);
    }

    getLocalAmount() {
        return (this.raw.Currency == this.getCurrency() ? this.raw.Amount : -this.raw.transfer.Amount);
    }

    getExchangeRate() {
        return (this.raw.Currency == this.getCurrency() ? 1 : Math.abs(this.raw.Amount / this.raw.transfer.Amount));
    }

    getMemo() {
        let memo = this.raw.Action,
            type, game;

        if (this.raw.Game) {
            if (this.raw.Game.includes('NL Hold')) { type = 'NLH'; }
        }

        if (/Tournament|Table/.test(this.raw.Action) && !this.raw.Action.includes('Currency Conversion')) {
            game = this.raw.Table.replace(/^(\d+)/, '$1 - ');
        }

        return [memo, type, game].filter(Boolean).join(' - ');
    }

    getId() {
        return this.raw.Table.replace(/^(\d+).*$/, '$1') + this.getDate('X');
    }

    getCategory() {
        return 'Leisure:Betting';
    }

    getTransfer() {
        if (this.raw.transfer) {
            return 'PokerStars (' + this.raw.transfer.Currency + ')';
        }
    }

    getPayee() {
        // Real Money Transfer = player-to-player
        if (!this.isTransfer() && !this.raw.Action.includes('Real Money Transfer')) {
            return 'PokerStars';
        }
    }
}

module.exports = PokerStarsTransaction;
