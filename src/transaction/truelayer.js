const Transaction = require('../transaction');

class TruelayerTransaction extends Transaction {
    constructor(account, raw, adapter) {
        super(account, raw, adapter);
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
        return this._getDate(this.raw.timestamp, format.replace(/ HH:mm/, ''));
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
    }
}

module.exports = TruelayerTransaction;
