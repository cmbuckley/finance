const AuthClient = require('./lib/auth');

let monzoAdapter;

class Adapter {
    constructor(accountPath, config, logger) {
        this.accountPath = accountPath;
        this.config = config;
        this.data = getConfig('data');
        this.logger = logger;
    }

    async login(options) {
        const auth = new AuthClient(this.accountPath, this.config, this.logger);
        let config = await auth.login(options);
        this.token = config.token.access_token;
    }

    getAccessToken() {
        return this.token;
    }
}

function getConfigPath(file) {
    return __dirname + '/../config/' + file + '.json';
}

function getConfig(file) {
    return require(getConfigPath(file));
}

function getAdapter(account, logger) {
    const accountPath = getConfigPath(account),
        accountConfig = require(accountPath),
        adapterPath   = getConfigPath(accountConfig.type),
        adapterConfig = require(adapterPath);

    switch (accountConfig.type) {
        case 'monzo':
            const MonzoAdapter = require('./adapter/monzo');
            if (!monzoAdapter) { monzoAdapter = new MonzoAdapter(adapterPath, adapterConfig, logger.child({module: 'monzo'})); }
            monzoAdapter.addConfig(Object.assign({module: account}, accountConfig));
            return monzoAdapter;

        case 'starling':
        case 'truelayer':
            const Adapter = require('./adapter/' + accountConfig.type);
            return new Adapter(accountPath, adapterConfig, logger.child({module: account}));
    }
}

Adapter.getAll = function (accounts, logger) {
    let adapters = [];

    if (!Array.isArray(accounts)) {
        const LoadAdapter = require('./adapter/load');
        return [new LoadAdapter(file, logger)];
    }

    accounts.forEach(function (account) {
        try {
            const adapter = getAdapter(account, logger);
            if (!adapters.includes(adapter)) { adapters.push(adapter); }
        } catch (err) {
            if (err.code != 'MODULE_NOT_FOUND') { throw err; }
            accountLogger.error('Cannot find config for', account);
        }
    });

    return adapters;
};

module.exports = Adapter;
