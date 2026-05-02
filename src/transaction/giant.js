const Transaction = require('../transaction');

class GiantTransaction extends Transaction {

    isValid() {
        return this.raw.mode && (this.raw.amount != 0);
    }

    isDebit() {
        return (this.getLocalAmount() < 0);
    }

    getCurrency() {
        return 'GBP';
    }

    getLocalAmount() {
        if (!this.raw.mode) return 0;
        return (parseFloat(this.raw.amount.replace(',', ''), 10) * (this.raw.mode == 'income' ? 1 : -1)).toFixed(2);
    }

    getExchangeRate() {
        return 1;
    }

    _getDate() {
        return {
            value: this.raw.date,
            format: 'YYYY/MM/DD',
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
        return false;
    }
}

module.exports = GiantTransaction;
