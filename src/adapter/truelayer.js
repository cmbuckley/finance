const {DataAPIClient} = require('truelayer-client'),
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
            adapter = this;

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
                    adapter.logger.silly('Raw transaction', raw);
                    return new Transaction(accountMap[account.display_name] || account.display_name, raw, adapter, {});
                })));
            });
        }, Promise.resolve([]));
    }
}

module.exports = TruelayerAdapter;
