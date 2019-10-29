const fs = require('fs'),
    monzo = require('monzo-bank'),
    moment = require('moment-timezone'),
    Exporter = require('./exporter');

const auth = require('./lib/auth');
const args = require('yargs')
    .option('account',  {alias: 'a', describe: 'Which account to load', default: 'current', choices: ['prepaid', 'current', 'joint']})
    .option('format',   {alias: 'o', describe: 'Output format',         default: 'qif',     choices: ['qif', 'csv']})
    .option('from',     {alias: 'f', describe: 'Earliest date for transactions'})
    .option('to',       {alias: 't', describe: 'Latest date for transactions'})
    .option('no-topup', {            describe: 'Don’t include topup transactions'})
    .option('no-pot',   {            describe: 'Don’t include pot transactions'})
    .option('login',    {alias: 'l', describe: 'Force OAuth re-login'})
    .option('dump',     {alias: 'd', describe: 'Dump transactions to specified file'})
    .option('load',     {alias: 'u', describe: 'Load from a specified dump file'})
    .option('quiet',    {alias: 'q', describe: 'Suppress output'})
    .help('help')
    .argv;

const foreignCurrencies = {
    'Euros': 'EUR',
    'HK$':   'HKD',
    'Yen':   'JPY',
    'Złoty': 'PLN',
};

const categories = {
    mondo:         '', // legacy
    general:       '', // TODO inspect
    expenses:      'Job Expenses', // TODO expand
    groceries:     'Food:Groceries',

    bills: lookup('description', {
        'Computing': 'AWS',
        'Computing:Domains': /101DOMAIN|123[ -]?REG|NAMECHEAP|KEY-SYSTEMS/,
        'Computing:Software': /ITUNES|1PASSWORD|PADDLE\.COM/,
        'Donations': /JUSTGIVING/i,
        'House:Improvement': /TIMPSON/,
        'House:Insurance': /SIMPLY BUSINESS/,
        'Leisure:Betting': /Betbull|SKYBET|SKY BETTING|PP ONLINE|VIRAL INTERACTIVE/,
        'Taxes': 'HMRC',
        'Utilities:Gas': 'BRITISH GAS',
    }, 'Bills'),
    personal_care: lookup('description', {
        'Healthcare:Dental': 'DENTAL',
        'Healthcare:Eyecare': 'CONTACT LENSES',
        'Personal Care:Hair': 'CITY IMAGE',
        'Pet Care:Vet': 'VETERINARY',
    }, 'Personal Care'),
    entertainment: lookup('description', {
        'Leisure:Activities': /ACTIVE NETWORK|TOUGH MUDDER/,
        'Leisure:Betting': /Betbull|SKYBET|SKY BETTING|PP ONLINE|VIRAL INTERACTIVE|PAYPAL \*BV/,
        'Leisure:Cinema': 'CINEMA',
        'Leisure:Climbing': 'CLIMBING',
        'Leisure:Music': /VINYL|HMV UK/i,
        'Leisure:Music Events': /RECORDS|TICKETMASTER|SHEFFIELDSTUDENTSU/,
        'Leisure:Snowboarding': 'SNOZONE',
    }, 'Nights Out'),
    holidays: foursquareCategory({
        'Art Museum': 'Holiday:Activities',
        'Hotel': 'Holiday:Accommodation',
        'Post Office': 'Holiday',
    }, lookup('description', {
        'Car:Parking': 'MANCHESTER AIRPORT CAR',
        'Food:Eating Out': 'HMSHOST',
        'Holiday:Accommodation': /MOXY STRATFORD|HOTEL|Booking\.com/,
        'Holiday:Souvenirs': 'WDFG',
        'Holiday:Travel': /Trainline|WIZZ AIR|LOT INTERNET POLAND/,
        'Nights Out:Stag Do': 'GROUPIA',
    })),
    eating_out: foursquareCategory({
        'Fast Food Restaurant': 'Food:Takeaway',
        'Fried Chicken Joint':  'Food:Takeaway',
    }, lookup('description', {
        'Food': /CENTRE FILLING|UPTON GROUP|SESAME +LEEDS|MARKS&SPENCER/,
        'Food:Takeaway': /JUST[ -]EAT|DOMINO'S PIZZA|SUBWAY|DELIVEROO|GREGGS/i,
    }, 'Food:Eating Out')),
    shopping: foursquareCategory({
        'Board Shop': 'Clothing',
        'Bookstore': 'Leisure:Books & Magazines',
        'Boutique': 'Clothing',
        'Clothing Store': 'Clothing',
        'Convenience Store': 'House', // not groceries
        'Cosmetics Shop': 'Gifts',
        'Department Store': 'Clothing',
        'Food & Drink Shop': 'Food',
        'Furniture / Home Store': 'House:Furniture',
        'Gift Shop': 'Gifts',
        'Jewelry Store': 'Gifts',
        'Miscellaneous Shop': 'House',
        'Sporting Goods Shop': 'Sporting Goods',
        'Supermarket': 'House', // not groceries
        'Warehouse Store': 'House',
    }, lookup('description', {
        'Clothing': /MULBERRY|SELFRIDGES|HARRODS|JCHOOLIM|LPP|Polo Factory Store|HARVEY NICHOLS|INTIMISSIMI|J\.CHOO|VICTORIAS SECRET|PRIMARK|KLARNA/,
        'Food:Alcohol': 'Veeno',
        'Gifts': /W\.KRUK|WARNER BROS STUDIOS|CAVENDISH JEWELLERS/,
        'House:Improvement': /BARGAIN TOOLS|SCREWFIX/,
        'Leisure:Toys & Games': /LH TRADING|NINTENDO/,
    })),
    cash: lookup('local_currency', foreignCurrencies, function (transaction) {
        if (transaction.counterparty.user_id) {
            return 'Loan';
        }
    }),
    transport: foursquareCategory({
        'Gas Station': 'Car:Petrol',
        'Gas Station / Garage': 'Car:Petrol',
        'Parking': 'Car:Parking',
        'Train': 'Travel:Rail',
        'Train Station': 'Travel:Rail',
    }, lookup('description', {
        'Car:Parking': /NCP |CAR PARK|MANCHESTER AIRPORT|DONCASTER SHEFFIEL|LeedsCityCouncil|CITY OF YORK COUNC/i,
        'Car:Petrol': /EG HOLLINWOOD|MFG  PHOENIX|LOTOS|TESCO PFS|ADEL SF|PAY AT PUMP|PETROL|MALTHURST LIMITED/,
        'Holiday:Travel': /RYANAIR/,
        'Travel:Bus': /AUT BILET|MPSA|MEGABUS/,
        'Travel:Rail': /GVB|Trainline|TFL.gov/i,
        'Travel:Taxi': /UBER|bolt\.eu/i,
    })),
    family: foursquareCategory({
        'Garden Center': 'House:Garden',
        'Pet Store': 'Pet Care',
        'Supermarket': 'House',
        'Warehouse Store': 'House',
    }, lookup('description', {
        'House:Improvement': /B & Q|BARGAIN TOOLS LIMITED/,
        'Pet Care:Accommodation': /MANSTON PET HOTEL|PAWSHAKE/,
        'Pet Care:Food': /ZooPlus/i,
        'Pet Care:Vet': 'VETERINARY',
    })),
};

function transfer(transaction, config) {
    if (transaction.counterparty) {
        if (transaction.counterparty.sort_code &&
            transaction.counterparty.account_number
        ) {
            let key = transaction.counterparty.sort_code.match(/\d{2}/g).join('-')
                    + ' ' + transaction.counterparty.account_number;

            if (config.transfers[key]) {
                return config.transfers[key];
            }
        }

        if (config.transfers[transaction.counterparty.user_id]) {
            return config.transfers[transaction.counterparty.user_id];
        }

        if (config.transfers[transaction.counterparty.account_id]) {
            return config.transfers[transaction.counterparty.account_id];
        }
    }

    if (transaction.merchant && config.transfers[transaction.merchant.group_id]) {
        return config.transfers[transaction.merchant.group_id];
    }

    if (transaction.merchant && transaction.merchant.atm) {
        let currencies = Object.assign({Cash: 'GBP'}, foreignCurrencies),
            account = lookup('local_currency', currencies)(transaction);

        if (!account) {
            warn('Unknown withdrawn currency', transaction.local_currency);
        }

        return account;
    }

    if (/^PAYPAL /.test(transaction.description)) {
        return 'PayPal';
    }

    // legacy
    if (transaction.category == 'mondo' &&
        transaction.amount > 0 &&
        !transaction.counterparty.user_id
        && transaction.is_load
    ) {
        return 'Current Account';
    }
}

function lookup(key, matches, defaultResponse) {
    return function (transaction) {
        let isFunction   = (typeof defaultResponse === 'function'),
            defaultFunc  = (isFunction ? defaultResponse : function () {}),
            defaultValue = (isFunction ? null : defaultResponse);

        return Object.keys(matches).find(function (match) {
            let pattern = matches[match],
                value = transaction[key];

            return (pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern));
        }) || defaultFunc(transaction) || defaultValue || '';
    };
}

function foursquareCategory(matches, defaultValue) {
    return function (transaction) {
        if (transaction.merchant && transaction.merchant.metadata) {
            if (matches[transaction.merchant.metadata.foursquare_category]) {
                return matches[transaction.merchant.metadata.foursquare_category];
            }
        }

        return (typeof defaultValue == 'function') ? defaultValue(transaction) : defaultValue;
    };
}

function exit(scope) {
    return function (err) {
        console.error('Error with', scope);
        console.error(err.stack || err.error || err);
    };
}

function warn() {
    if (!args.quiet) {
        console.error.apply(console, arguments);
    }
}

function timestamp(date) {
    return date ? date + 'T00:00:00Z' : undefined;
}

function date(timestamp) {
    return moment(timestamp).tz('Europe/London');
}

function category(transaction) {
    let category = (categories.hasOwnProperty(transaction.category)
                 ? categories[transaction.category]
                 : transaction.category);

    if (typeof category == 'function') {
        category = category(transaction);
    }

    if (category) {
        return category;
    }

    if (transaction.merchant && !transaction.merchant.atm) {
        return '';
    }

    warn(
        'Unknown category for ' + transaction.id,
        '(' + transaction.category + '):',
        '[' + (transaction.merchant ? transaction.merchant.name || '' : '') + ']',
        transaction.notes || transaction.description
    );
}

function payee(transaction, config) {
    // use known payee name if we have one
    if (transaction.counterparty.user_id) {
        if (transfer(transaction, config)) {
            return '';
        }

        if (config.payees[transaction.counterparty.user_id]) {
            return config.payees[transaction.counterparty.user_id];
        }

        if (transaction.counterparty.sort_code && transaction.counterparty.account_number) {
            let key = transaction.counterparty.sort_code.match(/\d{2}/g).join('-')
                    + ' ' + transaction.counterparty.account_number;

            if (config.payees[key]) {
                return config.payees[key];
            }

            warn('Unknown payee', transaction.counterparty.user_id, key, transaction.counterparty.name);
        } else if (/^user_/.test(transaction.counterparty.user_id)) {
            warn('Unknown Monzo payee', transaction.counterparty.user_id + ':', transaction.counterparty.name || '(no name)');
        } else {
            warn('Unknown payee', transaction.counterparty.user_id, transaction.counterparty.name);
        }

        return transaction.counterparty.name || '';
    }

    if (transaction.merchant && transaction.merchant.id) {
        if (config.payees[transaction.merchant.id]) {
            return config.payees[transaction.merchant.id];
        }

        if (config.payees[transaction.merchant.group_id]) {
            return config.payees[transaction.merchant.group_id];
        }

        if (!transfer(transaction, config)) {
            warn(
                'Unknown merchant',
                transaction.merchant.id + ':' + transaction.merchant.group_id + ':' + date(transaction.created).format('YYYY-MM-DD') + ':',
                transaction.merchant.name || ''
            );
        }
    }

    return '';
}

function account(accounts, type) {
    const typeMap = {
        joint: 'uk_retail_joint',
        current: 'uk_retail',
        prepaid: 'uk_prepaid'
    };

    return accounts.find(a => a.type == typeMap[type]);
}

auth.login({
    forceLogin: args.login,
    fakeLogin: args.load
}).then(function (config) {
    function process(transactions) {
        exporter.write(transactions.map(function (transaction) {
            if (
                transaction.decline_reason // failed
                || !transaction.amount // zero amount transaction
                || (args.topup === false && transaction.is_load && !transaction.counterparty.user_id && transaction.amount > 0) // ignore topups
                || (args.pot === false && transaction.scheme == 'uk_retail_pot') // ignore pot
            ) {
                return false;
            }

            return {
                date:          date(transaction.created),
                amount:        transaction.amount,
                memo:          (transaction.notes || transaction.description).replace(/[ \n]+/g, ' '),
                payee:         payee(transaction, config),
                transfer:      transfer(transaction, config),
                category:      (category(transaction) || ''),
                id:            transaction.id,
                localCurrency: transaction.local_currency,
                localAmount:   transaction.local_amount,
                currency:      transaction.currency,
                amount:        transaction.amount,
                atm:           (transaction.merchant && transaction.merchant.atm),
            };
        }));

        // pots request
        if (!args.quiet && args.account == 'current' && !args.load) {
            monzo.pots(config.token.access_token).then(function (response) {
                response.pots.map(function (pot) {
                    if (!pot.deleted) {
                        console.log(
                            'Your Monzo balance includes a pot "' + pot.name + '" containing',
                            exporter.helpers.numberFormat(pot.balance, pot.currency),
                            pot.currency
                        );
                    }
                });
            }).catch(exit('pots'));
        }
    }

    const exporter = Exporter({
        format:  args.format || 'qif',
        quiet:   args.quiet,
        name:    'monzo',
        account: {prepaid: 'Monzo Prepaid', current: 'Monzo', joint: 'Monzo Joint'}[args.account],
    });

    // load from dump file
    if (args.load) {
        return fs.readFile(args.load, 'utf8', function (err, data) {
            process(JSON.parse(data));
        });
    }

    monzo.accounts(config.token.access_token).then(function (response) {
        monzo.transactions({
          account_id: account(response.accounts, args.account).id,
          expand:     'merchant',
          since:      timestamp(args.from),
          before:     timestamp(args.to)
        }, config.token.access_token).then(function (response) {
            if (args.dump) {
                return Exporter({format: 'json', file: args.dump}).write(response.transactions);
            }

            process(response.transactions);
        }).catch(function (resp) {
            if (resp.error && resp.error.code == 'forbidden.verification_required') {
                return console.error('Cannot query older transactions - please refresh permissions in the Monzo app');
            }

            return exit('transactions')(resp);
        });
    }).catch(exit('accounts'));
}).catch(exit('token'));
