const Transaction = require('../transaction');

class GiantTransaction extends Transaction {

    isValid() {
        return this.raw.mode && (this.raw.amount != 0);
    }

    isDebit() {
        return (this.raw.mode == 'deductions');
    }

    getCurrency() {
        return 'GBP';
    }

    getLocalAmount() {
        if (!this.raw.mode) return 0;
        return (this.raw.amount * (this.raw.mode == 'income' ? 1 : -1)).toFixed(2);
    }

    getExchangeRate() {
        return 1;
    }

    _getDate() {
        return {
            value: this.raw.date,
            format: 'DD/MM/YYYY',
        };
    }

    getPayee() {
        return this.raw.payee;
    }

    getCategory() {
        return this.raw.category;
    }

    getMemo() {
        return this.raw.memo;
    }

    getId() {
        return '';
    }

    isTransfer() {
        return !!this.raw.transfer;
    }

    getTransfer() {
        return this.raw.transfer;
    }
}

module.exports = GiantTransaction;
