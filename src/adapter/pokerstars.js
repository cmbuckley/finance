const fs = require('fs'),
    util = require('util');

const csv = require('neat-csv');

const Adapter = require('../adapter'),
    Transaction = require('../transaction/pokerstars');

let transactions;

class PokerStarsAdapter extends Adapter {
    constructor(accountPath, config, logger) {
        super(accountPath, config, logger);
    }

    async login(options) {
        const file = await util.promisify(fs.readFile)(this.config.source, 'utf8');
        transactions = await csv(file, {
            skipLines: 2,
            mapHeaders: ({ header }) => ({
                'Date/Time': 'DateTime',
                'Table Name / Player / Tournament #': 'Table',
                'Account Currency': 'Currency',
                'Accrued StarsCoin': 'StarsCoin',
                'T Money': 'TMoney',
                'W Money': 'WMoney',
                'Total Accrued StarsCoin After this Transaction': 'StarsCoinAccrued',
            }[header] || header),
        });
    }

    async getTransactions(from, to) {
        return transactions.map((raw, index) => {
            this.logger.silly('Raw transaction', raw);

            // get the adjacent transfer
            // always listed with crediting account first
            if (raw.Action == 'Inter Account Transfer') {
                raw.transfer = transactions[index + Math.sign(raw.Amount)];
            }

            // search for the transfer
            if (raw.Action.includes('Currency Conversion')) {
                raw.transfer = this.getTransfer(raw);
            }

            return new Transaction(this.getAccountName(raw), raw, this, this.logger);
        });
    }

    /*
     * Get the associated transaction for a currency conversion by searching the list.
     * Conversions are not consistently listed in debit/credit order, so it's not possible to traverse.
     */
    getTransfer(raw) {
        const transfer = transactions.find(t => {
            return t.DateTime == raw.DateTime
                && t.Action == raw.Action
                && t.Table == raw.Table
                && t.Currency != raw.Currency;
        });

        if (transfer) { return transfer; }
        this.logger.error('Cannot find transfer transaction', raw);
    }

    getAccountName(raw) {
        return `${this.config.name} (${raw.Currency})`;
    }
}

module.exports = PokerStarsAdapter;
