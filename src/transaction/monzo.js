const Transaction = require('../transaction');

class MonzoTransaction extends Transaction {
    constructor(account, raw, adapter, logger, accountConfig) {
        super(account, raw, adapter, logger, {isMinorCurrency: true});
        this.accountConfig = accountConfig || {};
    }

    getModule() {
        return this.accountConfig.module;
    }

    isValid() {
        if (
            this.raw.decline_reason // failed
            || !this.raw.amount // zero amount transaction
            || (this.raw.is_load && !this.raw.counterparty.user_id && this.raw.amount > 0) // ignore topups
            || (this.raw.scheme == 'uk_retail_pot' && this.raw.metadata.trigger == 'coin_jar') // ignore round-up
            || (this.raw.scheme == 'uk_retail_pot' && this.adapter.pots && this.adapter.pots[this.raw.metadata.pot_id].round_up) // ignore withdraw from round-up
        ) {
            return false;
        }

        if (!this.isSettled() && this.isForeign()) {
            this.logger.warn('UNSETTLED TRANSACTION, AMOUNT MAY CHANGE', {
                date: this.getDate('YYYY-MM-DD HH:mm'),
                transaction: this.raw.id,
                merchant: this.raw.merchant ? this.raw.merchant.name || '' : '',
                note: this.raw.notes || this.raw.description,
            });
        }

        return true;
    }

    isDebit() {
        return this.raw.local_amount < 0;
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

    _getDate() {
        return this.raw.created;
    }

    getCurrency() {
        return this.raw.local_currency || '';
    }

    getLocalAmount() {
        return this._getAmount(this.raw.local_amount);
    }

    getExchangeRate() {
        if (this.raw.local_currency == this.raw.currency) { return 1; }
        return Math.pow(10, this._numDecimals(this.raw.local_currency) - this._numDecimals(this.raw.currency)) * this.raw.amount / this.raw.local_amount;
    }

    getMemo() {
        if (this.raw.scheme == 'uk_retail_pot' && this.adapter.pots) {
            return (this.isDebit() ? 'Added to' : 'Withdrew from') + ' ' + this.adapter.pots[this.raw.metadata.pot_id].name;
        }

        if (this.raw.scheme == 'p2p_payment' && this.raw.merchant) { return 'For ' + this.raw.merchant.name; }
        return (this.raw.notes || this.raw.description).replace(/[ \n]+/g, ' ');
    }

    getId() {
        return this.raw.id;
    }

    _getCategory() {
        // ignore internal pot transfers
        if (this.raw.scheme == 'uk_retail_pot') {
            return '';
        }

        this.logger.warn('Unknown category', {
            category: this.raw.category,
            merchant: this.raw.merchant ? this.raw.merchant.name || '' : '',
            merch_cat: this.raw.merchant ? this.raw.merchant.metadata.foursquare_category || '' : '',
            notes: this.raw.notes,
            description: this.raw.description,
            date: this.getDate('YYYY-MM-DD HH:mm'),
            transaction: this.raw.id,
        });
    }

    _getCounterParty() {
        if (this.raw.counterparty) {
            if (this.raw.counterparty.sort_code &&
                this.raw.counterparty.account_number
            ) {
                return this._getBank(this.raw.counterparty.sort_code, this.raw.counterparty.account_number);
            }

            if (this.adapter.data.transfers?.[this.raw.counterparty.user_id]) {
                return this.raw.counterparty.user_id;
            }

            if (this.adapter.data.transfers?.[this.raw.counterparty.account_id]) {
                return this.raw.counterparty.account_id;
            }
        }

        if (this.adapter.data?.transfers?.[this.raw.merchant?.group_id]) {
            return this.raw.merchant.group_id;
        }
    }

    // only considers it a PayPal transfer if the transaction was by the authenticated user
    _checkPayPal(transfer) {
        if (transfer != 'PayPal') { return transfer; }
        return (this.raw.user_id == this.adapter.getUser() ? transfer : '');
    }

    getTransfer() {
        const counterparty = this._getCounterParty();
        if (counterparty) {
            return this._checkPayPal(this._getTransfer(counterparty));
        }

        if (/^PAYPAL/.test(this.raw.description) || (this.raw.merchant && this.raw.merchant.name == 'PayPal')) {
            return this._checkPayPal('PayPal');
        }

        if (this.isCashWithdrawal()) {
            return this._getTransfer(this.getCurrency());
        }

        if (this.raw.scheme == 'uk_retail_pot' && this.adapter.pots) {
            return 'Monzo ' + this.adapter.pots[this.raw.metadata.pot_id].name;
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
        if (this.raw.counterparty?.user_id) {
            if (this.isTransfer()) {
                return '';
            }

            if (this.adapter.data?.payees?.[this.raw.counterparty.user_id]) {
                return this.adapter.data.payees[this.raw.counterparty.user_id];
            }

            if (this.raw.counterparty.sort_code && this.raw.counterparty.account_number) {
                const bank = this._getBank(this.raw.counterparty.sort_code, this.raw.counterparty.account_number);

                if (this.adapter.data?.payees?.[bank]) {
                    return this.adapter.data.payees[bank];
                }

                this.logger.warn('Unknown bank payee', {
                    transaction: this.raw.id,
                    user: this.raw.counterparty.user_id,
                    account: bank,
                    name: this.raw.counterparty.name
                });
            } else if (/^user_/.test(this.raw.counterparty.user_id)) {
                this.logger.warn('Unknown Monzo payee', {
                    transaction: this.raw.id,
                    user: this.raw.counterparty.user_id,
                    name: this.raw.counterparty.name
                });
            } else {
                this.logger.warn('Unknown payee', {
                    transaction: this.raw.id,
                    user: this.raw.counterparty.user_id,
                    name: this.raw.counterparty.name
                });
            }

            return this.raw.counterparty.name || '';
        }

        if (this.raw.merchant && this.raw.merchant.id) {
            if (this.adapter.data.payees?.[this.raw.merchant.id]) {
                return this.adapter.data.payees[this.raw.merchant.id];
            }

            if (this.adapter.data.payees?.[this.raw.merchant.group_id]) {
                return this.adapter.data.payees[this.raw.merchant.group_id];
            }

            if (!this.isTransfer()) {
                this.logger.warn('Unknown merchant', {
                    online: this.raw.merchant.online ? 'yes' : 'no',
                    merchant: this.raw.merchant.id,
                    group: this.raw.merchant.group_id,
                    date: this.getDate('YYYY-MM-DD HH:mm'),
                    name: this.raw.merchant.name
                });
            }
        }

        return '';
    }
}

module.exports = MonzoTransaction;
