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
            adapter = this,
            cardsResults;

        try {
            let cardsResponse = await DataAPIClient.getCards(accessToken);
            cardsResults = cardsResponse.results;
        } catch (err) {
            this.logger.warn('Error getting cards: ' + err);
            cardsResults = [];
        }

        // get transactions for normal accounts and card accounts
        return await accountsResponse.results.concat(cardsResults).reduce(async function (previousPromise, account) {
            let previousTransactions = await previousPromise,
                apiMethod = (account.card_type ? 'getCardTransactions' : 'getTransactions');

            adapter.logger.verbose('Getting transactions for account', account);

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
