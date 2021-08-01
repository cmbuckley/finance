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
        async function getLedgers(offset) {
            return await kraken.api('Ledgers', {start: from.unix(), end: to.unix(), ofs: offset || 0});
        }

        let response = await getLedgers(),
            ledger = response.result.ledger;

        // query further pages
        while (Object.keys(ledger).length < response.result.count) {
            let nextResponse = await getLedgers(Object.keys(ledger).length);
            ledger = Object.assign(ledger, nextResponse.result.ledger);
        }

        let ids = Object.keys(ledger),
            values = Object.values(ledger),
            trades = {},
            adapter = this;

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
                raw.trade = ledger[other];
            }

            if (raw.fee > 0) {
                // use a separate transaction to track the fee
                transactions.push(new Transaction(Object.assign({}, raw, {type: 'fee'}), adapter));
            }

            transactions.push(new Transaction(raw, adapter));
            return transactions;
        }, []);
    }
}

module.exports = KrakenAdapter;
