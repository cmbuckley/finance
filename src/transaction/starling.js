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

    getDate(format) {
        return this._getDate(this.raw.transactionTime, format);
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

        let category = (helpers.categories.hasOwnProperty(this.raw.category)
                     ? helpers.categories[this.raw.category]
                     : this.raw.category);

        if (typeof category == 'function') {
            category = category(this.raw);
        }

        if (category) {
            return category;
        }

        // ignore ATM withdrawals and internal pot transfers
        if ((this.raw.scheme == 'uk_retail_pot') || this.isCashWithdrawal()) {
            return '';
        }

        helpers.warn(
            'Unknown category for ' + this.raw.id,
            '(' + this.raw.category + '):',
            '[' + (this.raw.merchant ? this.raw.merchant.name || '' : '') + ']',
            this.raw.notes || this.raw.description
        );
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
        // use known payee name if we have one
        if (this.raw.counterparty.user_id) {
            if (this.isTransfer()) {
                return '';
            }

            if (helpers.config.payees[this.raw.counterparty.user_id]) {
                return helpers.config.payees[this.raw.counterparty.user_id];
            }

            if (this.raw.counterparty.sort_code && this.raw.counterparty.account_number) {
                let key = this.raw.counterparty.sort_code.match(/\d{2}/g).join('-')
                        + ' ' + this.raw.counterparty.account_number;

                if (helpers.config.payees[key]) {
                    return helpers.config.payees[key];
                }

                helpers.warn('Unknown payee', this.raw.counterparty.user_id, key, this.raw.counterparty.name);
            } else if (/^user_/.test(this.raw.counterparty.user_id)) {
                helpers.warn('Unknown Monzo payee', this.raw.counterparty.user_id + ':', this.raw.counterparty.name || '(no name)');
            } else {
                helpers.warn('Unknown payee', this.raw.counterparty.user_id, this.raw.counterparty.name);
            }

            return this.raw.counterparty.name || '';
        }

        if (this.raw.merchant && this.raw.merchant.id) {
            if (helpers.config.payees[this.raw.merchant.id]) {
                return helpers.config.payees[this.raw.merchant.id];
            }

            if (helpers.config.payees[this.raw.merchant.group_id]) {
                return helpers.config.payees[this.raw.merchant.group_id];
            }

            if (!this.isTransfer()) {
                helpers.warn(
                    'Unknown merchant',
                    this.raw.merchant.id + ':' + this.raw.merchant.group_id + ':' + this.getDate('YYYY-MM-DD') + ':',
                    this.raw.merchant.name || ''
                );
            }
        }

        return '';
    }
}

module.exports = StarlingTransaction;
