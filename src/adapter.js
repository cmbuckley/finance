const AuthClient = require('./lib/auth');

let monzoAdapter;

class Adapter {
    constructor(accountPath, config, logger) {
        this.accountPath = accountPath;
        this.config = config;
        this.data = getConfig('data', {});
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

function getConfig(file, defaultConfig) {
    try {
        return require(getConfigPath(file));
    } catch (err) {
        if (defaultConfig) { return defaultConfig; }
        throw err;
    }
}

function getAdapter(account, logger, options) {
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

        case 'pokerstars':
            adapterConfig.source = options.pokerstarsSource;

        case 'kraken':
        case 'starling':
        case 'truelayer':
            const Adapter = require('./adapter/' + accountConfig.type);
            return new Adapter(accountPath, adapterConfig, logger.child({module: account}));

        default: logger.error('Unrecognised adapter: ' + accountConfig.type);
    }
}

Adapter.getAll = function (accounts, logger, options) {
    let adapters = [];

    if (!Array.isArray(accounts)) {
        const LoadAdapter = require('./adapter/load');
        return [new LoadAdapter(accounts, logger)];
    }

    accounts.forEach(function (account) {
        try {
            const adapter = getAdapter(account, logger, options);
            if (adapter && !adapters.includes(adapter)) { adapters.push(adapter); }
        } catch (err) {
            if (err.code != 'MODULE_NOT_FOUND') { throw err; }
            logger.error('Cannot find config for module ' + account, err);
        }
    });

    return adapters;
};

module.exports = Adapter;
