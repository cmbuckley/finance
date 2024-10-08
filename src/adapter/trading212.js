const axios = require('axios'),
    Adapter = require('../adapter');

const pkg = require('../../package.json'),
    Transaction = require('../transaction/trading212');

class Trading212Adapter extends Adapter {

    constructor(accountConfigPath, adapterConfig, logger) {
        super(accountConfigPath, adapterConfig, logger);
        this.name = this.loadConfig(accountConfigPath, {}).name || '';
    }

    async login(options) {
    }

    async getTransactions(from, to) {
        const client = axios.create({
            baseURL: 'https://live.services.trading212.com',
            headers: {
                Accept: 'application/json',
                'User-Agent': [pkg.name, pkg.verison].join('/'),
                Cookie: 'TRADING212_SESSION_LIVE=' + this.config.token,
            },
        });

        const response = await client.get('/rest/history/interest', {
            params: {
                newerThan: from.toISOString(),
                olderThan: to.toISOString(),
            },
        });

        return response.data.data.map(raw => {
            return new Transaction(this.name, raw, this, this.logger);
        });
    }
}

module.exports = Trading212Adapter;
