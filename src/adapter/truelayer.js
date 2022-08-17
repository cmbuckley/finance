const {DataAPIClient} = require('truelayer-client'),
    moment = require('moment'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/truelayer');

class TruelayerAdapter extends Adapter {

    constructor(accountConfigPath, adapterConfig, logger) {
        super(accountConfigPath, adapterConfig, logger);
        this.accountMap = require(accountConfigPath).names || {};
    }

    async getTransactions(from, to) {
        let accountMap = this.accountMap,
            accessToken = this.getAccessToken(),
            accountsResponse = await DataAPIClient.getAccounts(accessToken),
            cardsResponse = await DataAPIClient.getCards(accessToken),
            adapter = this;

        // get transactions for normal accounts and card accounts
        return await accountsResponse.results.concat(cardsResponse.results).reduce(async function (previousPromise, account) {
            let previousTransactions = await previousPromise,
                apiMethod = (account.card_type ? 'getCardTransactions' : 'getTransactions');

            return new Promise(async function (res, rej) {
                let transactionsResponse;

                try {
                    transactionsResponse = await DataAPIClient[apiMethod](
                        accessToken,
                        account.account_id,
                        from.format('YYYY-MM-DD'),
                        moment.min(moment(), to).format('YYYY-MM-DD')
                    );
                } catch (err) {
                    return rej(err);
                }

                res(previousTransactions.concat(transactionsResponse.results.map(function (raw) {
                    adapter.logger.silly('Raw transaction', raw);
                    return new Transaction(accountMap[account.account_id] || account.display_name, raw, adapter, adapter.logger);
                })));
            });
        }, Promise.resolve([]));
    }

    getDefaultConfig() {
        return {
            credentials: {
                auth: {
                    tokenHost: 'https://auth.truelayer.com',
                    tokenPath: '/connect/token',
                    authorizeHost: 'https://auth.truelayer.com',
                    authorizePath: '/',
                },
                options: {
                    scopeSeparator: ' ',
                    authorizationMethod: 'body',
                }
            },
            // https://docs.truelayer.com/docs/scopes
            scope: [
                'info',
                'accounts',
                'balance',
                'transactions',
                'offline_access',
                'cards',
            ],
        };
    }
}

module.exports = TruelayerAdapter;
