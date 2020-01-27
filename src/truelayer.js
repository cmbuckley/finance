const fs = require('fs'),
    {DataAPIClient} = require('truelayer-client'),
    moment = require('moment-timezone'),
    Yargs = require('yargs'),
    Exporter = require('./exporter'),
    Transaction = require('./transaction/truelayer'),
    AuthClient = require('./lib/auth');

const args = Yargs.options({
        account:    {alias: 'a', describe: 'Which account to load',          default: 'all', choices: ['hsbc', 'fd', 'all'], type: 'array'},
        format:     {alias: 'o', describe: 'Output format',                  default: 'csv',     choices: ['qif', 'csv']},
        from:       {alias: 'f', describe: 'Earliest date for transactions', default: 0},
        to:         {alias: 't', describe: 'Latest date for transactions',   default: undefined},
        login:      {alias: 'l', describe: 'Force OAuth re-login'},
        //dump:       {alias: 'd', describe: 'Dump transactions to specified file'},
        //load:       {alias: 'u', describe: 'Load from a specified dump file'},
        quiet:      {alias: 'q', describe: 'Suppress output'},
    }).coerce({
        account: function (account) {
            if (account.length == 1 && account[0] == 'all') {
                // remove 'all' option and send the rest
                return Yargs.getOptions().choices.account.slice(0, -1);
            }

            return account;
        },
        from: (f => moment(f)),
        to:   (t => moment(t)),
    }).help('help').argv;

const accountMap = {
    'HSBC Premier Account': 'Current Account',
};

const auth = new AuthClient({
    configPath: __dirname + '/../config/truelayer.json'
});

auth.login({
    forceLogin: args.login,
}).then(async function (config) {
    const exporter = Exporter({
        format:  args.format,
        quiet:   args.quiet,
        name:    'truelayer',
    });

    let accountsResponse = await DataAPIClient.getAccounts(config.token.access_token);

    let transactions = await accountsResponse.results.reduce(async function (previousPromise, account) {
        let previousTransactions = await previousPromise;

        return new Promise(async function (res, rej) {
            let transactionsResponse;

            try {
                transactionsResponse = await DataAPIClient.getTransactions(
                    config.token.access_token,
                    account.account_id,
                    args.from.format('YYYY-MM-DD'),
                    args.to.format('YYYY-MM-DD')
                );
            } catch (err) {
                return rej(err);
            }

            res(previousTransactions.concat(transactionsResponse.results.map(function (raw) {
                const transaction = new Transaction(accountMap[account.display_name], raw, {});
                return (transaction.isValid() ? transaction : false);
            })));
        });

    }, Promise.resolve([]));

    await exporter.write(transactions.filter(Boolean));
}).catch(console.error);
