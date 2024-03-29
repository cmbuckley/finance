const monzo = require('monzo-bank'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/monzo');

var helpers = {
    decimalExceptions: {JPY: 0},
    decimals: function (currency) {
        return this.decimalExceptions[currency] ?? 2;
    },
    numberFormat: function (amount, currency) {
        var decimals = this.decimals(currency);
        return (amount / Math.pow(10, decimals)).toFixed(decimals);
    },
    pick: (obj, ...keys) => Object.fromEntries(keys.map(k => [k, obj[k]])),
};

class MonzoAdapter extends Adapter {
    constructor(accountPath, config, logger) {
        super(accountPath, config, logger);
        this.accountMap = {};
        this.pots = {};
    }

    addConfig(accountConfig) {
        this.accountMap[accountConfig.account] = accountConfig;
    }

    getUser() {
        return this.config.token.user_id;
    }

    async getTransactions(from, to) {
        let accessToken = this.getAccessToken(),
            accountMap = this.accountMap,
            adapter = this,
            accounts, transactions;

        try {
            let accountsResponse = await monzo.accounts(accessToken);
            accounts = accountsResponse.accounts.filter(a => Object.keys(accountMap).includes(a.type));
        } catch (err) {
            throw err.error || err;
        }

        transactions = await accounts.reduce(async function (previousPromise, account) {
            let transactions = await previousPromise,
                accountLogger = adapter.logger.child({module: accountMap[account.type].module});

            return new Promise(async function (resolve, reject) {
                let potsResponse, transactionsResponse;

                try {
                    let potsResponse = await monzo.pots(account.id, accessToken);

                    potsResponse.pots.map(async function (pot) {
                        adapter.pots[pot.id] = pot;

                        if (!pot.deleted && pot.round_up) {
                            let accountBalance = await monzo.balance(account.id, accessToken);

                            accountLogger.info('Your Monzo balance includes a pot', {
                                pot: pot.name,
                                amount: helpers.numberFormat(pot.balance, pot.currency),
                                total: helpers.numberFormat(pot.balance + accountBalance.balance, accountBalance.currency),
                                currency: pot.currency,
                            });
                        }
                    });
                } catch (err) {
                    reject(err.error);
                }

                const limit = 100;
                let since = from.toISOString();

                do {
                    if (since.startsWith('tx_')) {
                        adapter.logger.verbose('Retrieving subsequent page', {since, limit});
                    }

                    try {
                        transactionsResponse = await monzo.transactions({
                          account_id: account.id,
                          expand:     'merchant',
                          since:      since,
                          before:     to.toISOString(),
                          limit:      limit,
                        }, accessToken);

                        if (transactionsResponse.transactions.length) { since = transactionsResponse.transactions.at(-1).id; }

                        transactions = transactions.concat(transactionsResponse.transactions.map(function (raw) {

                            accountLogger.silly('Raw transaction', raw);
                            return new Transaction(accountMap[account.type].name || account.display_name, raw, adapter, accountLogger, accountMap[account.type]);
                        }));
                    } catch (resp) {
                        if (resp.error && resp.error.code == 'forbidden.verification_required') {
                            return reject('Cannot query older transactions - please refresh permissions in the Monzo app');
                        }

                        return reject(resp.error || resp);
                    }
                } while (transactionsResponse.transactions && transactionsResponse.transactions.length == limit);

                resolve(transactions);
            });
        }, Promise.resolve([]));

        adapter.logger.verbose(`Retrieved ${transactions.length} transactions`);
        return transactions;
    }

    getDefaultConfig() {
        return {
            credentials: {
                auth: {
                    tokenHost: 'https://api.monzo.com/',
                    tokenPath: '/oauth2/token',
                    authorizeHost: 'https://auth.monzo.com/',
                    authorizePath: '/',
                },
                options: {
                    authorizationMethod: 'body',
                }
            },
            must_approve_token: true,
        };
    }

    toJSON() {
        // pick only specific fields from each pot
        const pots = Object.fromEntries(Object.entries(this.pots).map(([i, p]) => [i, helpers.pick(p, 'name', 'round_up')]));
        return {pots, user: this.config.token.user_id};
    }
}

module.exports = MonzoAdapter;
