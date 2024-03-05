const fs = require('fs').promises;
const csv = (...args) => import('neat-csv').then(({default: neatCsv}) => neatCsv(...args));

const Adapter = require('../adapter'),
    Transaction = require('../transaction/pokerstars');

let transactions;

class PokerStarsAdapter extends Adapter {
    async login(options) {
        const file = await fs.readFile(this.config.source, 'utf8');
        transactions = await csv(file, {
            skipLines: 2,
            mapHeaders: ({ header }) => ({
                'Date/Time': 'DateTime',
                'Table Name / Player / Tournament #': 'Table',
                'Account Currency': 'Currency',
                'Accrued StarsCoin': 'StarsCoin',
                'T Money': 'TMoney',
                'W Money': 'WMoney',
                'Total Accrued StarsCoin After this Transaction': 'StarsCoinBalance',
            }[header] || header),
        });
    }

    async getTransactions(from, to) {
        return transactions.map((raw, index) => {
            this.logger.silly('Raw transaction', raw);

            // manual transfer between accounts
            if (raw.Action == 'Inter Account Transfer') {
                raw.transfer = this.getTransfer(raw);
            }

            // automatic conversion at buy-in
            if (raw.Action.includes('Currency Conversion')) {
                raw.transfer = this.getTransfer(raw, true);
            }

            const transaction = new Transaction(this.getAccountName(raw), raw, this, this.logger);
            if (transaction.getDate().isBetween(from, to, 'seconds', '[]')) {
                return transaction;
            }
        }).filter(Boolean);
    }

    /*
     * Get the associated transaction for a currency conversion by searching the list
     * Manual inter-account transfers have different IDs (1 digit difference?)
     * Auto currency conversion have the same ID (the tournament)
     */
    getTransfer(raw, sameTable) {
        const transfer = transactions.find(t => {
            return t.DateTime == raw.DateTime
                && t.Action == raw.Action
                && (!sameTable || t.Table == raw.Table)
                && Math.sign(t.Amount) + Math.sign(raw.Amount) == 0
                && t.Currency != raw.Currency;
        });

        if (transfer) { return transfer; }
        this.logger.error('Cannot find matching conversion transaction', raw);
    }

    getAccountName(raw) {
        return `${this.config.name} (${raw.Currency})`;
    }
}

module.exports = PokerStarsAdapter;
