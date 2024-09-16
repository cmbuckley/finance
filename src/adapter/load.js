const fs = require('fs').promises,
    path = require('path'),
    Adapter = require('../adapter');

const getTransactionClass = className => require('../transaction/' + className);

class LoadAdapter extends Adapter {
    #adapterConfig = {};
    #delegates = {};

    constructor(file, logger) {
        super(null, null, logger);
        this.file = file;
    }

    async login(options) {
    }

    delegate(adapter) {
        if (!this.#delegates[adapter]) {
            this.#delegates[adapter] = {
                monzo: {
                    pots: this.#adapterConfig.monzo?.pots || {},
                    getUser: () => this.#adapterConfig.monzo?.user,
                },
            }[adapter] || {};

            this.#delegates[adapter].__proto__ = this;
        }

        return this.#delegates[adapter];
    }

    async _loadTransactions(from, to) {
        const stats = await fs.lstat(this.file);

        // dump file
        if (stats.isFile()) {
            return JSON.parse(await fs.readFile(this.file, 'utf-8'));
        }

        // store directory (<store>/<module>/<year>.json)
        if (stats.isDirectory()) {
            const adapters = JSON.parse(await fs.readFile(path.join(this.file, 'adapters.json'), 'utf-8'));
            let transactions = [];

            // loop through modules
            for (let sub of await fs.readdir(this.file)) {
                sub = path.join(this.file, sub);

                if ((await fs.lstat(sub)).isDirectory()) {

                    // loop through years
                    for (const yearFile of await fs.readdir(sub)) {
                        const year = yearFile.split('.')[0];

                        // only load file if it's in the range we've asked for
                        if (year >= from.year() && year <= to.year()) {
                            transactions = transactions.concat(Object.values(JSON.parse(await fs.readFile(path.join(sub, yearFile), 'utf-8'))));
                        }
                    }
                }
            }

            return {adapters, transactions};
        }
    }

    async getTransactions(from, to) {
        const data = await this._loadTransactions(from, to);
        this.#adapterConfig = data.adapters || {};

        return data.transactions.map(t => {
            if (!t.type) { throw new Error(`Unknown transaction type in ${t.module}:` + t); }

            const Transaction = getTransactionClass(t.type);
            return new Transaction(t.account, t.raw, this.delegate(t.type), this.logger.child({module: t.module}));
        }).filter(t => t.getDate().isBetween(from, to, null, '[]'));
    }
}

module.exports = LoadAdapter;
