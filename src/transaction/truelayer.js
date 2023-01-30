const Transaction = require('../transaction');

class TruelayerTransaction extends Transaction {
    constructor(account, raw, adapter, logger) {
        super(account, raw, adapter, logger);
    }

    isValid() {
        return true;
    }

    isDebit() {
        return (this.raw.transaction_type == 'DEBIT');
    }

    isCashWithdrawal() {
        return (this.raw.merchant && this.raw.merchant.atm);
    }

    isSettled() {
        return true;
    }

    isForeign() {
        return this.raw.currency !== 'GBP';
    }

    getDate(format, timezone) {
        if (format) {
            const date = super.getDate();

            // check if there's a time component (unlikely unless fixed by a transfer)
            if (!date.diff(date.clone().startOf('day'))) {
                format = format.replace(' HH:mm', '');
            }
        }

        return super.getDate(format, timezone);
    }

    _getDate() {
        return this.raw.timestamp;
    }

    getCurrency() {
        return this.raw.currency || '';
    }

    getLocalAmount() {
        // flip amount for credit cards, where DEBIT is a positive amount
        let factor = (this.isDebit() == (this.raw.amount > 0) ? -1 : 1);
        return this._getAmount(this.raw.amount * factor);
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

    _getCategory() {
        this.logger.warn('Unknown category', {
            category: this.raw.transaction_classification,
            description: this.raw.description,
            date: this.getDate('YYYY-MM-DD'),
            transaction: this.raw.id,
        });
    }

    getTransfer() {
        if (/^\d{6} \d{8}/.test(this.raw.description)) {
            let [sortCode, account] = this.raw.description.match(/^(\d{6}) (\d{8})/).slice(1);
            return this._getTransfer(this._getBank(sortCode, account)) || '';
        }

        const transfers = {
            'ISA':                /LYP ISA TRANSFER/,
            'PayPal':             /^PAYPAL/,
            'Current Account':    /DIRECT DEBIT PAYMENT|Chris HSBC|BUCKLEY CM Bills/,
            'Premier Saver':      /RSB REGULAR SAVER/,
            'Credit Card':        /HSBC CREDIT CARD|HSBC CARD PYMT/,
            'First Direct':       /^BUCKLEY C SHARED ACCOUNT|MR C BUCKLEY|Joint Account/,
            'Monzo Current':      /^MONZO|Sent from Monzo|Monzo -/,
            'Monzo Joint':        /Monzo Joint|JOINT MONZO|C Buckley & Emilia/,
            'Payslips':           /HESTVIEW|ANSWER DIGITAL LIM336/,
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
