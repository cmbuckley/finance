const fs = require('fs').promises,
    Adapter = require('../adapter');

class LoadAdapter extends Adapter {
    #adapterConfig = {};
    #delegates = {};

    constructor(file, logger) {
        super(null, null, logger);
        this.file = file;
    }

    async login(options) {
        return Promise.resolve();
    }

    _getTransaction(className) {
        return require('../transaction/' + className);
    }

    delegate(adapter) {
        if (!this.#delegates[adapter]) {
            this.#delegates[adapter] = {
                monzo: {
                    pots: this.#adapterConfig.monzo.pots,
                    getUser: () => this.#adapterConfig.monzo.user,
                },
            }[adapter] || {};

            this.#delegates[adapter].__proto__ = this;
        }

        return this.#delegates[adapter];
    }

    async getTransactions() {
        const data = JSON.parse(await fs.readFile(this.file, 'utf-8'));
        this.#adapterConfig = data.adapters;

        return data.transactions.map(t => {
            const Transaction = this._getTransaction(t.type);
            return new Transaction(t.account, t.raw, this.delegate(t.type), this.logger.child({module: t.module}));
        });
    }
}

module.exports = LoadAdapter;
