const fs = require('fs'),
    {DataAPIClient} = require('truelayer-client'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/truelayer');

class TruelayerAdapter extends Adapter {

    constructor(accountConfigPath, adapterConfig) {
        super(accountConfigPath, adapterConfig);
        this.accountMap = require(accountConfigPath).names || {};
    }

    async getTransactions(from, to) {
        let accountMap = this.accountMap,
            accessToken = this.getAccessToken(),
            accountsResponse = await DataAPIClient.getAccounts(accessToken);

        return await accountsResponse.results.reduce(async function (previousPromise, account) {
            let previousTransactions = await previousPromise;

            return new Promise(async function (res, rej) {
                let transactionsResponse;

                try {
                    transactionsResponse = await DataAPIClient.getTransactions(
                        accessToken,
                        account.account_id,
                        from.format('YYYY-MM-DD'),
                        to.format('YYYY-MM-DD')
                    );
                } catch (err) {
                    return rej(err);
                }

                res(previousTransactions.concat(transactionsResponse.results.map(function (raw) {
                    return new Transaction(accountMap[account.display_name] || account.display_name, raw, {});
                })));
            });
        }, Promise.resolve([]));
    }
}

module.exports = TruelayerAdapter;