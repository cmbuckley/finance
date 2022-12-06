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
        const transfers = {
            'ISA':                /^404401 [0-9]{4}3752|LYP ISA TRANSFER/,
            'Current Account':    /^404401 [0-9]{4}5471|BUCKLEY C|DIRECT DEBIT PAYMENT|Chris HSBC/,
            'Online Bonus Saver': /^404401 [0-9]{4}8681/,
            'Premier Saver':      /^404401 [0-9]{4}6646|RSB REGULAR SAVER/,
            'Credit Card':        /HSBC CREDIT CARD|HSBC CARD PYMT/,
            'First Direct':       /BUCKLEY C SHARED ACCOUNT|MR C BUCKLEY|Joint Account|Buckley C/,
            'Monzo Current':      /^MONZO|Sent from Monzo|Monzo -/,
            'Monzo Joint':        /Monzo Joint|JOINT MONZO|C Buckley & Emilia/,
            'PayPal':             /^PAYPAL/,
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
