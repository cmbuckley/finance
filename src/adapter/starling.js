const Starling = require('starling-developer-sdk'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/starling');

class StarlingAdapter extends Adapter {
    async getTransactions(from, to) {
        let accessToken = this.getAccessToken(),
            client = new Starling({accessToken}),
            accountsResponse = await client.account.getAccounts(),
            transactions = [];

        for (const account of accountsResponse.data.accounts) {
            const transactionsResponse = await client.feedItem.getFeedItemsBetween({
                accountUid: account.accountUid,
                categoryUid: account.defaultCategory,
                minTransactionTimestamp: from.toISOString(),
                maxTransactionTimestamp: to.toISOString(),
            });

            transactions = transactions.concat(transactionsResponse.data.feedItems.map(raw => {
                this.logger.silly('Raw transaction', raw);
                return new Transaction(this.config.name, raw, this, this.logger);
            }));
        }

        return transactions;
    }

    getDefaultConfig() {
        return {
            credentials: {
                auth: {
                  tokenHost: 'https://api.starlingbank.com',
                  tokenPath: '/oauth/access-token',
                  authorizeHost: 'https://oauth.starlingbank.com',
                  authorizePath: '/'
                },
                options: {
                  authorizationMethod: 'body'
                }
            }
        };
    }
}

module.exports = StarlingAdapter;
