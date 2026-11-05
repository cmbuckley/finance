const {MonzoClient} = require('monzo-sdk'),
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
        this.client = new MonzoClient();
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
            accounts, transactions = [];

        this.client.setTokens({accessToken});

        try {
            let accountsResponse = await this.client.accounts.list();
            accounts = accountsResponse.filter(a => Object.keys(accountMap).includes(a.type));
        } catch (err) {
            throw err.error || err;
        }

        for (const account of accounts) {
            const accountLogger = this.logger.child({module: accountMap[account.type].module}),
                accountBalance = await this.client.balance.read({account_id: account.id}),
                potsResponse = await this.client.pots.list({current_account_id: account.id}),
                limit = 100;

            let hiddenBalances = 0;

            potsResponse.map(async pot => {
                this.pots[pot.id] = pot;

                if (!pot.deleted && (pot.round_up || pot.style == 'penny_savings_challenge')) {
                    hiddenBalances += pot.balance;

                    accountLogger.verbose('Your Monzo balance includes a pot', {
                        pot: pot.name,
                        amount: helpers.numberFormat(pot.balance, pot.currency),
                        currency: pot.currency,
                    });
                }
            });

            if (hiddenBalances > 0) {
                accountLogger.info('Your Monzo balance includes hidden pots', {
                    total: helpers.numberFormat(hiddenBalances + accountBalance.balance, account.currency),
                });
            }

            let since = from.toISOString(),
                transactionsResponse;

            do {
                if (since.startsWith('tx_')) {
                    this.logger.verbose('Retrieving subsequent page', {since, limit});
                }

                try {
                    transactionsResponse = await this.client.transactions.list({
                      account_id: account.id,
                      expand:     'merchant',
                      since:      since,
                      before:     to.toISOString(),
                      limit:      limit,
                    });

                    if (transactionsResponse.length) { since = transactionsResponse.at(-1).id; }

                    transactions = transactions.concat(transactionsResponse.map(raw => {

                        accountLogger.silly('Raw transaction', raw);
                        return new Transaction(accountMap[account.type].name || account.display_name, raw, this, accountLogger, accountMap[account.type]);
                    }));
                } catch (err) {
                    if (err.error && err.error.code == 'forbidden.verification_required') {
                        throw 'Cannot query older transactions - please refresh permissions in the Monzo app';
                    }

                    throw err.error || err;
                }
            } while (transactionsResponse && transactionsResponse.length == limit);
        }

        this.logger.verbose(`Retrieved ${transactions.length} transactions`);
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
        const pots = Object.fromEntries(Object.entries(this.pots).map(([i, p]) => [i, helpers.pick(p, 'name', 'round_up', 'style')]));
        return {pots, user: this.config.token.user_id};
    }
}

module.exports = MonzoAdapter;
