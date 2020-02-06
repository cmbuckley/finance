const moment = require('moment-timezone');

const decimalExceptions = {JPY: 0};
let helpers = {};

function numDecimals(currency) {
    return (decimalExceptions.hasOwnProperty(currency) ? decimalExceptions[currency] : 2);
}

function numberFormat(amount, currency) {
    var decimals = numDecimals(currency);
    return (amount / Math.pow(10, decimals)).toFixed(decimals);
}

class MonzoTransaction {
    constructor(account, rawData, monzoHelpers) {
        this.account = account;
        this.raw = rawData;
        helpers = monzoHelpers || {};
    }

    isValid() {
        if (
            this.raw.decline_reason // failed
            || !this.raw.amount // zero amount transaction
            || (!helpers.ignoreTopups && this.raw.is_load && !this.raw.counterparty.user_id && this.raw.amount > 0) // ignore topups
            || (this.raw.scheme == 'uk_retail_pot' && this.raw.metadata.trigger == 'coin_jar') // ignore round-up
            || (this.raw.scheme == 'uk_retail_pot' && helpers.pots[this.raw.metadata.pot_id].round_up) // ignore withdraw from round-up
        ) {
            return false;
        }

        if (!this.isSettled() && this.isForeign()) {
            helpers.warn(
                '### UNSETTLED TRANSACTION, AMOUNT MAY CHANGE:',
                this.getDate('YYYY-MM-DD'),
                (this.raw.merchant ? this.raw.merchant.name : this.notes) || ''
            );
        }

        return true;
    }

    isDebit() {
        return this.raw.local_amount < 0;
    }

    isTransfer() {
        return !!this.getTransfer();
    }

    isCashWithdrawal() {
        return (this.raw.merchant && this.raw.merchant.atm);
    }

    isSettled() {
        return !!this.raw.settled;
    }

    isForeign() {
        return this.raw.local_currency !== this.raw.currency;
    }

    getAccount() {
        return this.account;
    }

    getDate(format) {
        return moment(this.raw.created).tz('Europe/London').format(format);
    }

    getCurrency() {
        return this.raw.local_currency || '';
    }

    getLocalAmount(inverse) {
        return numberFormat((inverse ? -1 : 1) * this.raw.local_amount, this.getCurrency());
    }

    getExchangeRate() {
        if (this.raw.local_currency == this.raw.currency) { return 1; }
        return Math.pow(10, numDecimals(this.raw.local_currency) - numDecimals(this.raw.currency)) * this.raw.amount / this.raw.local_amount;
    }

    getMemo() {
        if (this.raw.scheme == 'uk_retail_pot') { return 'Added to Pot'; }
        if (this.raw.scheme == 'p2p_payment' && this.raw.merchant) { return 'For ' + this.raw.merchant.name; }
        return (this.raw.notes || this.raw.description).replace(/[ \n]+/g, ' ');
    }

    getId() {
        return this.raw.id;
    }

    getCategory() {
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

module.exports = MonzoTransaction;
