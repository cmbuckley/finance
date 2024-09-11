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
            transactions = [],
            accounts = [],
            cards = [];

        try {
            const accountsResponse = await DataAPIClient.getAccounts(accessToken);
            accounts = accountsResponse.results;
        } catch (err) {
            this.logger.warn('Error getting accounts: ' + err);
        }

        try {
            const cardsResponse = await DataAPIClient.getCards(accessToken);
            cards = cardsResponse.results;
        } catch (err) {
            this.logger.warn('Error getting cards: ' + err);
        }

        // get transactions for normal accounts and card accounts
        for (const account of accounts.concat(cards)) {
            for (const type of ['Transactions', 'PendingTransactions']) {
                let apiMethod = `get${account.card_type ? 'Card' : ''}${type}`;
                this.logger.verbose(`Calling ${apiMethod} for account`, account);

                const transactionsResponse = await DataAPIClient[apiMethod](
                    accessToken,
                    account.account_id,
                    from.format('YYYY-MM-DD'),
                    moment.min(moment(), to).format('YYYY-MM-DD')
                );

                transactions = transactions.concat(transactionsResponse.results.map(raw => {
                    this.logger.silly('Raw transaction', raw);
                    return new Transaction(accountMap[account.account_id] || account.display_name, raw, this, this.logger);
                }));
            }
        }

        return transactions;
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
