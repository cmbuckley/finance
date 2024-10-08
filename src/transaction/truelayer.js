const Transaction = require('../transaction');

class TruelayerTransaction extends Transaction {

    #getLocal() {
        const matches = this.raw.description.match(/ ([A-Z]{3}) (\d+\.\d{2}) @ \d+\.\d+/);
        if (matches) {
            return {
                currency: matches[1],
                amount:   matches[2] * Math.sign(this.raw.amount),
                rate:     Math.abs(matches[2] / this.raw.amount), // more accurate
            };
        }

        return {
            currency: this.raw.currency,
            amount:   this.raw.amount,
            rate:     1,
        };
    }

    constructor(account, raw, adapter, logger) {
        super(account, raw, adapter, logger);
    }

    isValid() {
        return !!this.raw.amount;
    }

    isDebit() {
        return (this.raw.transaction_type == 'DEBIT');
    }

    isCashWithdrawal() {
        return (this.raw.merchant && this.raw.merchant.atm);
    }

    isSettled() {
        return true;
    }

    isForeign() {
        return this.getCurrency() !== 'GBP';
    }

    getDate(format, timezone) {
        if (format) {
            const date = super.getDate();

            // check if there's a time component (unlikely unless fixed by a transfer)
            if (!date.diff(date.clone().startOf('day'))) {
                format = format.replace(' HH:mm', '');
            }
        }

        return super.getDate(format, timezone);
    }

    _getDate() {
        return this.raw.timestamp;
    }

    getCurrency() {
        return this.#getLocal().currency || '';
    }

    getLocalAmount() {
        // flip amount for credit cards, where DEBIT is a positive amount
        let factor = (this.isDebit() == (this.raw.amount > 0) ? -1 : 1);
        return this._getAmount(this.#getLocal().amount * factor);
    }

    getExchangeRate() {
        return this.#getLocal().rate;
    }

    getMemo() {
        return this.raw.description.replace(/[ \n]+/g, ' ');
    }

    getId() {
        return this.raw.normalised_provider_transaction_id;
    }

    _getCategory() {
        this.logger.warn('Unknown category', {
            category: this.raw.transaction_classification,
            description: this.raw.description,
            date: this.getDate('YYYY-MM-DD HH:mm'),
            transaction: this.raw.id,
        });
    }

    getTransfer() {
        if (this._transfer) { return this._transfer.getAccount(); }

        if (/^\d{6} \d{8}/.test(this.raw.description)) {
            let [sortCode, account] = this.raw.description.match(/^(\d{6}) (\d{8})/).slice(1);
            return this._getTransfer(this._getBank(sortCode, account)) || '';
        }

        if (this.adapter.data?.transfers?.patterns) {
            const patterns = this.adapter.data.transfers.patterns;

            for (const p in patterns) {
                const regex = new RegExp(patterns[p].pattern || patterns[p], patterns[p].flags);

                if (regex.test(this.raw.description)) {
                    return p;
                }
            }
        }
    }

    getPayee() {
        return this.raw.merchant_name || '';
    }
}

module.exports = TruelayerTransaction;
