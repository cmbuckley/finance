const fs = require('fs'),
    moment = require('moment-timezone'),
    Yargs = require('yargs'),
    winston = require('winston'),
    Adapter = require('./adapter'),
    Exporter = require('./exporter');

function coerceDate(d) {
    const m = moment(d);
    if (m.isValid()) { return m; }
    throw new Error('Invalid date: ' + d);
}

function coerceFile(file) {
    if (fs.existsSync(file)) { return file; }
    throw new Error('File does not exist: ' + file);
}

const accountChoices = [
    'all',
    'fd', 'hsbc',
    'mc', 'mj', 'mp',
    'revolut', 'starling',
    'kraken', 'pokerstars',
];

const args = Yargs.options({
        account:    {alias: 'a', type: 'array',   describe: 'Which account to load',          default: 'all', choices: accountChoices},
        format:     {alias: 'o', type: 'string',  describe: 'Output format',                  default: 'csv', choices: ['qif', 'csv']},
        from:       {alias: 'f', type: 'string',  describe: 'Earliest date for transactions', default: 0},
        to:         {alias: 't', type: 'string',  describe: 'Latest date for transactions',   default: undefined},
        login:      {alias: 'l', type: 'boolean', describe: 'Force OAuth re-login'},
        dump:       {alias: 'd', type: 'string',  describe: 'Dump transactions to specified file'},
        load:       {alias: 'u', type: 'string',  describe: 'Load from a specified dump file'},
        quiet:      {alias: 'q', type: 'boolean', describe: 'Suppress output'},
        verbose:    {alias: 'v', type: 'count',   describe: 'Verbose output'},

        'pokerstars-source': {type: 'string', describe: 'Source file for PokerStars input', default: 'pokerstars.csv'},
    }).coerce({
        account: function (account) {
            if (account.length == 1 && account[0] == 'all') {
                // remove 'all' option and send the rest
                return Yargs.getOptions().choices.account.slice(0, -1);
            }

            return account;
        },
        load: coerceFile,
        from: coerceDate,
        to:   coerceDate,
        'pokerstars-source': coerceFile,
    }).alias('help', 'h').help().argv;

const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            filename: 'app.log',
            level: 'debug',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
        new winston.transports.Console({
            prettyPrint: true,
            level: args.verbose ? Object.entries(winston.config.npm.levels).find(l => l[1] == Math.min(args.verbose + 3, 6))[0] : args.quiet ? 'error' : 'info',
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

        try {
            await adapter.login({forceLogin: args.login});
        } catch (err) {
            adapter.logger.error('Error logging in:', {message: err.message || err});
            return Promise.resolve(previousTransactions);
        }

        return new Promise(async function (res, rej) {
            let transactions = [];
            adapter.logger.info('Retrieving transactions', {from: args.from, to: args.to});

            try {
                transactions = await adapter.getTransactions(args.from, args.to);
            } catch (err) {
                adapter.logger.error('Error retrieving transactions:', {message: err.message || err});
            }

            res(previousTransactions.concat(transactions));
        });
    }, Promise.resolve([]));

    await exporter.write(transactions);
})();
