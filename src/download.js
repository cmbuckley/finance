const fs = require('fs'),
    moment = require('moment-timezone'),
    Yargs = require('yargs'),
    Adapter = require('./adapter'),
    Exporter = require('./exporter');

const args = Yargs.options({
        account:    {alias: 'a', describe: 'Which account to load',          default: 'all', choices: ['fd', 'hsbc', 'revolut', 'starling', 'mc', 'mj', 'ms', 'all'], type: 'array'},
        format:     {alias: 'o', describe: 'Output format',                  default: 'csv', choices: ['qif', 'csv']},
        from:       {alias: 'f', describe: 'Earliest date for transactions', default: 0},
        to:         {alias: 't', describe: 'Latest date for transactions',   default: undefined},
        login:      {alias: 'l', describe: 'Force OAuth re-login'},
        dump:       {alias: 'd', describe: 'Dump transactions to specified file'},
        load:       {alias: 'u', describe: 'Load from a specified dump file'},
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

(async () => {
    const exporter = Exporter({
        format:  args.format,
        quiet:   args.quiet,
        name:    'download',
    });

    const adapters = await Adapter.getAll(args.account);
    const transactions = await adapters.reduce(async function (previousPromise, adapter) {
        let previousTransactions = await previousPromise;
        await adapter.login();

        return new Promise(async function (res, rej) {
            let transactions;

            try {
                transactions = await adapter.getTransactions(args.from, args.to);
            } catch (err) {
                return rej(err);
            }

            res(previousTransactions.concat(transactions.filter(t => t.isValid())));
        });
    }, Promise.resolve([]));

    await exporter.write(transactions);
})();
