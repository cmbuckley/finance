const moment = require('moment-timezone');

const decimalExceptions = {JPY: 0};
let helpers;

function numDecimals(currency) {
    return (decimalExceptions.hasOwnProperty(currency) ? decimalExceptions[currency] : 2);
}

function numberFormat(amount, currency) {
    var decimals = numDecimals(currency);
    return amount.toFixed(decimals);
}

class TruelayerTransaction {
    constructor(account, raw, truelayerHelpers) {
        this.account = account;
        this.raw = raw;
        helpers = truelayerHelpers;
    }

    isValid() {
        return true;
    }

    isDebit() {
        return (this.raw.transaction_type == 'DEBIT');
    }

	// @todo
    isTransfer() {
        return !!this.getTransfer();
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

    getAccount() {
        return this.account;
    }

    getDate(format) {
        return moment(this.raw.timestamp).tz('Europe/London').format(format);
    }

    getCurrency() {
        return this.raw.currency || '';
    }

    getLocalAmount(inverse) {
        return numberFormat((inverse ? -1 : 1) * this.raw.amount, this.getCurrency());
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
        return undefined; // @todo

        if (this.raw.counterparty) {
            if (this.raw.counterparty.sort_code &&
                this.raw.counterparty.account_number
            ) {
                let key = this.raw.counterparty.sort_code.match(/\d{2}/g).join('-')
                        + ' ' + this.raw.counterparty.account_number;

                if (helpers.config.transfers[key]) {
                    return helpers.config.transfers[key];
                }
            }

            if (helpers.config.transfers[this.raw.counterparty.user_id]) {
                return helpers.config.transfers[this.raw.counterparty.user_id];
            }

            if (helpers.config.transfers[this.raw.counterparty.account_id]) {
                return helpers.config.transfers[this.raw.counterparty.account_id];
            }
        }

        if (this.raw.merchant && helpers.config.transfers[this.raw.merchant.group_id]) {
            return helpers.config.transfers[this.raw.merchant.group_id];
        }

        if (this.raw.merchant && this.raw.merchant.atm) {
            let currencies = Object.assign({Cash: 'GBP'}, helpers.foreignCurrencies),
                account = Object.keys(currencies)[Object.values(currencies).indexOf(this.raw.local_currency)];

            if (!account) {
                helpers.warn('Unknown withdrawn currency', this.raw.local_currency);
            }

            return account;
        }

        if (/^PAYPAL /.test(this.raw.description)) {
            return 'PayPal';
        }

        if (this.raw.scheme == 'uk_retail_pot') {
            return 'Monzo ' + helpers.pots[this.raw.metadata.pot_id].name;
        }

        // legacy
        if (this.raw.category == 'mondo' &&
            this.raw.amount > 0 &&
            !this.raw.counterparty.user_id
            && this.raw.is_load
        ) {
            return 'Current Account';
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
