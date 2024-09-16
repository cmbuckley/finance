const fs = require('fs'),
    moment = require('moment-timezone'),
    Yargs = require('yargs'),
    winston = require('winston'),
    Adapter = require('./adapter'),
    Exporter = require('./exporter');

function coerceDate(d) {
    const m = moment(d, true);
    if (m.isValid()) { return m; }
    throw new Error('Invalid date: ' + d);
}

function coerceFile(file) {
    if (fs.existsSync(file)) { return file; }
    throw new Error(file + ': No such file');
}

// empty argument sets the default folder
const coerceStore = store => (store === '' ? 'db' : store);

const accountChoices = {
    TrueLayer: [
        'amex', 'fd', 'hsbc',
        'revolut', 'starling',
    ],
    Monzo: [
        'mc', 'mj', 'mp',
    ],
    Custom: [
        'paypal',
    ],
    Experimental: [
        't212', 'kraken', 'pokerstars',
    ],
};

const args = Yargs.alias({help: 'h', version: 'V'}).options({
        account:    {alias: 'a', type: 'array',   describe: 'Which account(s) to load',       requiresArg: true, default: 'all', choices: ['all'].concat(Object.values(accountChoices).flat())},
        format:     {alias: 'o', type: 'string',  describe: 'Output format',                  requiresArg: true, default: 'csv', choices: ['qif', 'csv']},
        from:       {alias: 'f', type: 'string',  describe: 'Earliest date for transactions', requiresArg: true, default: 0},
        to:         {alias: 't', type: 'string',  describe: 'Latest date for transactions',   requiresArg: true, default: undefined},
        login:      {alias: 'l', type: 'boolean', describe: 'Force OAuth re-login for selected accounts'},
        dump:       {alias: 'd', type: 'string',  describe: 'Dump transactions to specified file',    requiresArg: true},
        load:       {alias: 'u', type: 'string',  describe: 'Load from a specified dump file',        requiresArg: true},
        store:      {alias: 's', type: 'string',  describe: 'Store transactions in specified folder'},
        retrieve:   {alias: 'r', type: 'string',  describe: 'Retrieve transactions from specified folder'},
        quiet:      {alias: 'q', type: 'boolean', describe: 'Suppress output'},
        verbose:    {alias: 'v', type: 'count',   describe: 'Verbose output (multiple options increases verbosity)'},

        'pokerstars-source': {type: 'string', describe: 'Source file for PokerStars input', requiresArg: true},
    })
    .usage('Usage: npm run download -- [options...]')
    .epilogue(Object.entries(accountChoices).reduce((acc, [type, accounts]) => acc + `\n  ${type}: ` + accounts.join(', '), 'Valid accounts:'))
    .group(['account', 'from', 'to'], 'Filtering transactions:')
    .group(['format', 'dump', 'load', 'store', 'retrieve', 'pokerstars-source'], 'Storage/retrieval:')
    .coerce({
        account: function (account) {
            if (account.length == 1 && account[0] == 'all') {
                // remove 'all' option and send the rest
                return Yargs.getOptions().choices.account.slice(1);
            }

            return account;
        },
        store:    coerceStore,
        retrieve: coerceStore,
        load: coerceFile,
        from: coerceDate,
        to:   coerceDate,
        'pokerstars-source': coerceFile,
    }).conflicts({
        dump: ['load', 'store'],
        load: ['store'],
    }).check(args => {
        if (!args.pokerstarsSource) { args.pokerstarsSource = 'pokerstars.csv'; }
        return true;
    }).usageConfiguration({
        'hide-types': true,
    }).argv;

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
        dump:     args.dump,
        store:    args.store,
        format:   args.format,
        logger:   logger.child({module: 'export'}),
        name:     'download',
        timezone: 'Europe/London',
    });

    const adapters = Adapter.getAll(args.load || args.retrieve || args.account, logger, args);

    let transactions = [],
        format = 'YYYY-MM-DD HH:mm';

    for (const adapter of adapters) {
        try {
            await adapter.login({forceLogin: args.login});
        } catch (err) {
            adapter.logger.error('Error logging in:', {message: err.message || err});
            throw err;
        }

        adapter.logger.info('Retrieving transactions', {from: args.from.format(format), to: args.to.format(format)});

        try {
            transactions = transactions.concat(await adapter.getTransactions(args.from, args.to));
        } catch (err) {
            adapter.logger.error('Error retrieving transactions:', {message: err.message || err});
            adapter.logger.debug(err.stack || err);
        }
    }

    await exporter.write(Adapter.detectTransfers(transactions, exporter.options.timezone));
})();
