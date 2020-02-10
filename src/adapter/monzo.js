const monzo = require('monzo-bank'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/monzo');

var helpers = {
    decimalExceptions: {JPY: 0},
    decimals: function (currency) {
        return (this.decimalExceptions.hasOwnProperty(currency) ? this.decimalExceptions[currency] : 2);
    },
    numberFormat: function (amount, currency) {
        var decimals = this.decimals(currency);
        return (amount / Math.pow(10, decimals)).toFixed(decimals);
    }
};

class MonzoAdapter extends Adapter {
    constructor(accountPath, config, logger) {
        super(accountPath, config, logger);
        this.accountMap = {};
        this.pots = {};
    }

    addConfig(accountConfig) {
        this.accountMap[accountConfig.account] = accountConfig.name;
    }

    async getTransactions(from, to) {
        let accessToken = this.getAccessToken(),
            potsResponse = await monzo.pots(accessToken);

        potsResponse.pots.map(function (pot) {
            this.pots[pot.id] = 'Monzo ' + pot;

            if (!pot.deleted && pot.round_up) {
                this.logger.info('Your Monzo balance includes a pot', {
                    pot: pot.name,
                    amount: helpers.numberFormat(pot.balance, pot.currency),
                    currency: pot.currency,
                });
            }
        }, this);

        let accountsResponse = await monzo.accounts(accessToken),
            accountMap = this.accountMap,
            accounts = accountsResponse.accounts.filter(a => Object.keys(accountMap).includes(a.type)),
            adapter = this;

        let transactions = await accounts.reduce(async function (previousPromise, account) {
            let transactions = await previousPromise;

            return new Promise(async function (resolve, reject) {
                let transactionsResponse;

                try {
                    transactionsResponse = await monzo.transactions({
                      account_id: account.id,
                      expand:     'merchant',
                      since:      from.toISOString(),
                      before:     to.toISOString(),
                    }, accessToken);
                } catch (resp) {
                    if (resp.error && resp.error.code == 'forbidden.verification_required') {
                        return reject('Cannot query older transactions - please refresh permissions in the Monzo app');
                    }

                    reject(resp);
                }

                resolve(transactions.concat(transactionsResponse.transactions.map(function (raw) {
                    return new Transaction(accountMap[account.type] || account.display_name, raw, adapter);
                })));
            });
        }, Promise.resolve([]));

        return transactions;
    }
}

module.exports = MonzoAdapter;
