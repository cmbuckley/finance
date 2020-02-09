const Transaction = require('../transaction');
let helpers = {};

class TruelayerTransaction extends Transaction {
    constructor(account, raw, truelayerHelpers) {
        super(account, raw);
        helpers = truelayerHelpers || {};
    }

    isValid() {
        return true;
    }

    isDebit() {
        return (this.raw.transaction_type == 'DEBIT');
    }

	// @todo
    isCashWithdrawal() {
        return (this.raw.merchant && this.raw.merchant.atm);
    }

    isSettled() {
        return true;
    }

	// @todo improve
    isForeign() {
        return this.raw.currency !== 'GBP';
    }

    getDate(format) {
        return this._getDate(this.raw.timestamp, format);
    }

    getCurrency() {
        return this.raw.currency || '';
    }

    getLocalAmount() {
        return this._getAmount(this.raw.amount);
    }

    // @todo
    getExchangeRate() {
        return 1;
    }

    getMemo() {
        return this.raw.description.replace(/[ \n]+/g, ' ');
    }

    getId() {
        return this.raw.transaction_id;
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
        const transfers = {
            'Current Account':    /^404401 [0-9]{4}5471|BUCKLEY CM|DIRECT DEBIT PAYMENT/,
            'ISA':                /^404401 [0-9]{4}3752|LYP ISA TRANSFER/,
            'Online Bonus Saver': /^404401 [0-9]{4}8681/,
            'Premier Saver':      /^404401 [0-9]{4}6646|RSB REGULAR SAVER/,
            'Credit Card':        /HSBC CREDIT CARD|HSBC CARD PYMT/,
            'First Direct':       /BUCKLEY C SHARED ACCOUNT|MR C BUCKLEY/,
            'Monzo Current':      /^MONZO|Sent from Monzo|Monzo -/,
            'Monzo Joint':        /Monzo Joint|JOINT MONZO/,
            'PayPal':             /^PAYPAL/,
            'Payslips':           'HESTVIEW',
            'Starling':           /^Starling/,
            'Cash':               /^CASH/,
        };

        for (let t in transfers) {
            if (transfers[t].test && transfers[t].test(this.raw.description) || transfers[t] == this.raw.description) {
                return t;
            }
        }
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

module.exports = TruelayerTransaction;
