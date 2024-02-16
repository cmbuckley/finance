const Transaction = require('../transaction');

module.exports = class PayPalTransaction extends Transaction {
    #conversion = [];

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
        return +this.raw.transaction_info.transaction_amount.value + +this.getFee();
    }

    getFee() {
        return (this.raw.transaction_info.fee_amount ? this.raw.transaction_info.fee_amount.value : 0);
    }

    getExchangeRate() {
        if (this.#conversion.length !== 2) { return 1; }

        // should be two transactions, one in the account currency and one in the transaction currency
        const localIndex = this.#conversion.findIndex(c => c.transaction_info.transaction_amount.currency_code == this.getCurrency());
        return -this.#conversion[1 - localIndex].transaction_info.transaction_amount.value
            / this.#conversion[localIndex].transaction_info.transaction_amount.value;
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

    addConversion(conversion) {
        this.#conversion = conversion;
    }
};
