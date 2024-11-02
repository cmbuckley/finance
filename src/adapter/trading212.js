const axios = require('axios'),
    OTPAuth = require('otpauth'),
    Adapter = require('../adapter'),
    AuthClient = require('../lib/auth');

const pkg = require('../../package.json'),
    Transaction = require('../transaction/trading212');

// cookies/headers to mimic the Trading212 app
const cookieName = 'TRADING212_SESSION_LIVE',
    clientHeaders = {
        Accept: 'application/json',
        'User-Agent': [pkg.name, pkg.version].join('/'),
        'X-Trader-Client': 'application=WC4,version=7.35.0,dUUID=162bce36-028e-42cd-8744-f458b1ee674e',
        demo: 'a77b0fa1b967178b9cedb352c41c5558',
    };

class Trading212Adapter extends Adapter {
    #client;

    constructor(accountConfigPath, adapterConfig, logger) {
        super(accountConfigPath, adapterConfig, logger);
        this.name = this.loadConfig(accountConfigPath, {}).name || '';
    }

    getClient() {
        if (!this.#client) {
            this.#client = axios.create({
                baseURL: 'https://live.services.trading212.com',
                headers: clientHeaders,
            });
        }

        return this.#client;
    }

    async login(options) {
        const auth = new AuthClient(this.accountPath, this.getConfig(), this.logger);
        const totp = new OTPAuth.TOTP({secret: this.config.credentials.otpSecret});

        const response = await this.getClient().post('/rest/v4/login', {
            username: this.config.credentials.username,
            password: this.config.credentials.password,
            rememberMe: true,
            twoFactorAuth: {
                authenticationCode: totp.generate(),
                rememberDevice: false,
            },
        }, {
            params: {
                skipVersionCheck: 'false',
            },
        });

        this.token = response.data.accountSession;
        auth.config = {token: this.token};
        await auth.saveConfig();
    }

    async getTransactions(from, to) {
        const response = await this.getClient().get('/rest/history/v2/interest', {
            headers: {
                Cookie: [cookieName, this.getAccessToken()].join('='),
            },
            params: {
                newerThan: from.toISOString(),
                olderThan: to.toISOString(),
            },
        });

        return response.data.data.map(raw => {
            this.logger.silly('Raw transaction', raw);
            return new Transaction(this.name, raw, this, this.logger);
        });
    }
}

module.exports = Trading212Adapter;
