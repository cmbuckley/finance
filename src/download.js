const moment = require('moment-timezone'),
    Yargs = require('yargs'),
    winston = require('winston'),
    Adapter = require('./adapter'),
    Exporter = require('./exporter');

const args = Yargs.options({
        account:    {alias: 'a', describe: 'Which account to load',          default: 'all', choices: ['fd', 'hsbc', 'revolut', 'starling', 'mc', 'mj', 'mp', 'all'], type: 'array'},
        format:     {alias: 'o', describe: 'Output format',                  default: 'csv', choices: ['qif', 'csv']},
        from:       {alias: 'f', describe: 'Earliest date for transactions', default: 0},
        to:         {alias: 't', describe: 'Latest date for transactions',   default: undefined},
        login:      {alias: 'l', describe: 'Force OAuth re-login'},
        dump:       {alias: 'd', describe: 'Dump transactions to specified file'},
        load:       {alias: 'u', describe: 'Load from a specified dump file'},
        quiet:      {alias: 'q', describe: 'Suppress output'},
        verbose:    {alias: 'v', describe: 'Verbose output'},
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

const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            filename: 'app.log',
            level: 'debug',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
        new winston.transports.Console({
            level: args.verbose ? 'debug' : args.quiet ? 'error' : 'info',
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(function (info) {
                    if (info.module) {
                        info.message = `[${info.module}] ` + info.message;
                        delete info.module;
                    }

                    return info;
                }),
                winston.format.simple()
            ),
        }),
    ]
});

(async () => {
    const exporter = Exporter({
        dump:    args.dump,
        format:  args.format,
        logger:  logger.child({module: 'export'}),
        name:    'download',
    });

    const adapters = Adapter.getAll(args.load || args.account, logger);
    const transactions = await adapters.reduce(async function (previousPromise, adapter) {
        let previousTransactions = await previousPromise;
        await adapter.login();

        return new Promise(async function (res, rej) {
            let transactions = [];
            adapter.logger.info('Retrieving transactions', {from: args.from, to: args.to});

            try {
                transactions = await adapter.getTransactions(args.from, args.to);
            } catch (err) {
                adapter.logger.error(err);
            }

            res(previousTransactions.concat(transactions));
        });
    }, Promise.resolve([]));

    await exporter.write(transactions);
})();
