const Transaction = require('../transaction');

module.exports = class PayPalTransaction extends Transaction {
    constructor(account, raw, adapter, logger) {
        super(account, raw, adapter, logger);
    }

    isValid() {
        return this.raw.transaction_info.transaction_status == 'S'
            && /^T[01][01]/.test(this.raw.transaction_info.transaction_event_code);
    }

    isDebit() {
        return this.raw.transaction_info.transaction_amount.value < 0;
    }

    isForeign() {
        return this.adapter.getConfig().currency != this.getCurrency();
    }

    _getDate() {
        return this.raw.transaction_info.transaction_initiation_date;
    }

    getCurrency() {
        return this.raw.transaction_info.transaction_amount.currency_code;
    }

    getLocalAmount() {
        return this.raw.transaction_info.transaction_amount.value;
    }

    getExchangeRate() {
        // @todo currency conversions in multiple rows
        return 1;
    }

    getMemo() {
        let memo = this.raw.transaction_info.transaction_note;

        if (!memo && this.raw.cart_info?.item_details?.length == 1) {
            memo = this.raw.cart_info.item_details[0].item_name;
        }

        return memo || this.raw.transaction_info.transaction_subject;
    }

    getId() {
        return this.raw.transaction_info.transaction_id;
    }

    _getCategory() {
        // @todo
    }

    getPayee() {
        if (this.adapter.data.payees[this.raw.payer_info.account_id]) {
            return this.adapter.data.payees[this.raw.payer_info.account_id];
        }

        // @todo
        return this.raw.payer_info.payer_name.alternate_full_name;
    }
};