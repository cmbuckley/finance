const KrakenClient = require('kraken-api'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/kraken');
let kraken;

class KrakenAdapter extends Adapter {
    constructor(accountPath, config, logger) {
        super(accountPath, config, logger);
    }

    async login(options) {
        kraken = new KrakenClient(this.config.credentials.key, this.config.credentials.secret);
    }

    async getTransactions(from, to) {
        let response = await kraken.api('Ledgers', {start: from.unix(), end: to.unix()}),
            ids = Object.keys(response.result.ledger),
            values = Object.values(response.result.ledger),
            trades = {};

        // build a map of ids with matching refids (these are trades)
        values.forEach((transaction, key) => {
            if (['spend', 'receive', 'trade'].includes(transaction.type)) {
                if (!trades[transaction.refid]) {
                    trades[transaction.refid] = [];
                }

                trades[transaction.refid].push(ids[key]);
            }
        });

        return values.reduce((transactions, raw, key) => {
            raw = Object.assign({}, raw);
            raw.id = ids[key];

            // add details about the trade if found
            if (trades[raw.refid]) {
                let other = trades[raw.refid].find(i => i != raw.id);
                raw.trade = response.result.ledger[other];
            }

            if (raw.fee > 0) {
                // use a separate transaction to track the fee
                transactions.push(new Transaction(Object.assign({}, raw, {type: 'fee'})));
            }

            transactions.push(new Transaction(raw));
            return transactions;
        }, []);
    }
}

module.exports = KrakenAdapter;
