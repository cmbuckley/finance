const axios = require('axios'),
    Adapter = require('../adapter');

const pkg = require('../../package.json'),
    Transaction = require('../transaction/trading212');

class Trading212Adapter extends Adapter {
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

        const response = await client.get('/rest/history/interest');

        return response.data.data.map(raw => {
            return new Transaction(this.config.name, raw, this, this.logger);
        });
    }
}

module.exports = Trading212Adapter;
