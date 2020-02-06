const Starling = require('starling-developer-sdk'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/starling');

class StarlingAdapter extends Adapter {
    constructor(accountConfigPath, adapterConfig) {
        super(accountConfigPath, adapterConfig);
    }

    async getTransactions(from, to) {
        let accessToken = this.getAccessToken(),
            client = new Starling({accessToken}),
            accountName = this.config.name,
            accountsResponse = await client.account.getAccounts();

        return await accountsResponse.data.accounts.reduce(async function (previousPromise, account) {
            let previousTransactions = await previousPromise;

            return new Promise(async function (res, rej) {
                let transactionsResponse;

                try {
                    transactionsResponse = await client.feedItem.getFeedItemsBetween({
                        accountUid: account.accountUid,
                        categoryUid: account.defaultCategory,
                        minTransactionTimestamp: from.toISOString(),
                        maxTransactionTimestamp: to.toISOString(),
                    });
                } catch (err) {
                    return rej(err);
                }

                res(previousTransactions.concat(transactionsResponse.data.feedItems.map(function (raw) {
                    return new Transaction(accountName, raw, {});
                })));
            });
        }, Promise.resolve([]));
    }
}

module.exports = StarlingAdapter;
