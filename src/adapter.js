const AuthClient = require('./lib/auth');

let monzoAdapter;

class Adapter {
    constructor(accountPath, config) {
        this.accountPath = accountPath;
        this.config = config;
        this.data = getConfig('data');
    }

    async login(options) {
        const auth = new AuthClient(this.accountPath, this.config);
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

function getAdapter(account) {
    const accountPath = getConfigPath(account),
        accountConfig = require(accountPath),
        adapterPath   = getConfigPath(accountConfig.type),
        adapterConfig = require(adapterPath);

    switch (accountConfig.type) {
        case 'truelayer':
            const TruelayerAdapter = require('./adapter/truelayer');
            return new TruelayerAdapter(accountPath, adapterConfig);

        case 'monzo':
            const MonzoAdapter = require('./adapter/monzo');
            if (!monzoAdapter) { monzoAdapter = new MonzoAdapter(adapterPath, adapterConfig); }
            monzoAdapter.addConfig(accountConfig);
            return monzoAdapter;

        case 'starling':
            const StarlingAdapter = require('./adapter/starling');
            return new StarlingAdapter(adapterPath, adapterConfig);
    }
}

Adapter.getAll = function (accounts) {
    let adapters = [];

    if (!Array.isArray(accounts)) {
        const LoadAdapter = require('./adapter/load');
        return [new LoadAdapter(file)];
    }

    accounts.forEach(function (account) {
        try {
            const adapter = getAdapter(account);
            if (!adapters.includes(adapter)) { adapters.push(adapter); }
        } catch (err) {
            if (err.code != 'MODULE_NOT_FOUND') { throw err; }
            console.log('Cannot find config for', account);
        }
    });

    return adapters;
};

module.exports = Adapter;
