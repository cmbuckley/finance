const merge = require('lodash.merge');
const AuthClient = require('./lib/auth');

const accountSpec = {
    amex:     {type: 'truelayer', provider: 'uk-ob-amex'},
    fd:       {type: 'truelayer', provider: 'uk-ob-first-direct'},
    hsbc:     {type: 'truelayer', provider: 'uk-ob-hsbc'},
    revolut:  {type: 'truelayer', provider: 'uk-ob-revolut'},
    starling: {type: 'truelayer', provider: 'uk-ob-starling'},
    mc:       {type: 'monzo', account: 'uk_retail'},
    mj:       {type: 'monzo', account: 'uk_retail_joint'},
    mp:       {type: 'monzo', account: 'uk_prepaid'},
    t212:     {type: 'trading212'},
};

let monzoAdapter;

class Adapter {
    constructor(accountPath, config, logger) {
        this.accountPath = accountPath;
        this.config = config;
        this.data = this.loadConfig('data', {payees: [], transfers: []});
        this.logger = logger;
    }

    loadConfig(file, defaultConfig) {
        return loadConfig(file, defaultConfig);
    }

    async login(options) {
        const auth = new AuthClient(this.accountPath, this.getConfig(), this.logger);
        let config = await auth.login(options);
        this.token = config.token.access_token;
    }

    getAccessToken() {
        return this.token;
    }

    getConfig() {
        return merge(this.getDefaultConfig(), this.config);
    }

    getDefaultConfig() {
        return {};
    }

    toJSON() {
    }
}

function getConfigPath(file) {
    return __dirname + '/../config/' + file + '.json';
}

// load config but fail silently if a default value is provided
function loadConfig(file, defaultConfig) {
    try {
        return require(file.includes('.json') ? file : getConfigPath(file));
    } catch (err) {
        if (defaultConfig) { return defaultConfig; }
        throw err;
    }
}

function getAdapter(account, logger, options) {
    const accountPath = getConfigPath(account),
        accountConfig = merge(accountSpec[account] || {}, loadConfig(accountPath, {})),
        adapterType   = accountConfig.type || account,
        adapterPath   = getConfigPath(adapterType),
        adapterConfig = require(adapterPath);

    switch (adapterType) {
        case 'monzo':
            const MonzoAdapter = require('./adapter/monzo');
            if (!monzoAdapter) { monzoAdapter = new MonzoAdapter(adapterPath, adapterConfig, logger.child({module: 'monzo'})); }
            monzoAdapter.addConfig(Object.assign({module: account}, accountConfig));
            return monzoAdapter;

        case 'pokerstars':
            adapterConfig.source = options.pokerstarsSource;

        case 'truelayer':
            adapterConfig.provider = accountConfig.provider;

        case 'kraken':
        case 'starling':
        case 'paypal':
        case 'trading212':
            const Adapter = require('./adapter/' + adapterType);
            return new Adapter(accountPath, Object.assign({module: account}, adapterConfig), logger.child({module: account}));

        default: logger.error('Unrecognised adapter: ' + adapterType);
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
            logger.error('Cannot load account ' + account + ':', err);
        }
    });

    return adapters;
};

Adapter.detectTransfers = function (transactions, timezone) {
    let transfers = transactions.filter(t => t.isTransfer() && t.isValid());
    transfers.forEach(t => {
        // try find the opposite transaction
        const counterpart = transactions.find(ct => {
            return ct !== t
                && ct.getAccount() == t.getTransfer()
                && ct.getCurrency() == t.getCurrency()
                && ct.getLocalAmount() == -t.getLocalAmount()
                && ct.getDate().clone().tz(timezone || 'UTC').isSame(t.getDate(), 'day')
        });

        if (counterpart) {
            const counterpartDate = counterpart.getDate(),
                counterpartMidnight = counterpartDate.clone().startOf('day');

            if (!counterpart.isTransfer()) {
                counterpart.setTransfer(t);
            }

            if (counterpartDate.diff(counterpartMidnight)) {
                // overwrite from counterpart
                t.getDate().set({
                    year:   counterpartDate.get('year'),
                    month:  counterpartDate.get('month'),
                    date:   counterpartDate.get('date'),
                    hour:   counterpartDate.get('hour'),
                    minute: counterpartDate.get('minute'),
                    second: counterpartDate.get('second'),
                });
            }
        }
    });
    return transactions;
};

module.exports = Adapter;
