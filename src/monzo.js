var fs = require('fs'),
    monzo = require('monzo-bank'),
    Exporter = require('./exporter');

const auth = require('./lib/auth');
const args = require('yargs')
    .option('account', {alias: 'a', describe: 'Which account to load', default: 'current', choices: ['prepaid', 'current', 'joint']})
    .option('format', {alias: 'o', describe: 'Output format', default: 'qif', choices: ['qif', 'csv']})
    .option('from', {alias: 'f', describe: 'Earliest date for transactions'})
    .option('to', {alias: 't', describe: 'Latest date for transactions'})
    .option('no-topup', {describe: 'Don’t include topup transactions'})
    .option('no-pot', {describe: 'Don’t include pot transactions'})
    .option('login', {alias: 'l', describe: 'Force OAuth re-login'})
    .option('dump', {alias: 'd', describe: 'Dump transactions to specified file'})
    .option('load', {alias: 'u', describe: 'Load from a specified dump file'})
    .help('help')
    .argv;

var currencies = {
    'Cash':  'GBP',
    'Euros': 'EUR',
    'HK$':   'HKD',
    'Yen':   'JPY',
    'Złoty': 'PLN',
};

var categories = {
    general:       '', // TODO inspect
    expenses:      'Job Expenses', // TODO expand
    bills:         'Bills',
    entertainment: 'Nights Out',
    groceries:     'Food:Groceries',
    personal_care: 'Healthcare',

    holidays: foursquareCategory({
        'Art Museum': 'Holiday:Activities',
        'Hotel': 'Holiday:Accommodation',
        'Post Office': 'Holiday',
    }, lookup('description', {
        'Car:Parking': 'MANCHESTER AIRPORT CAR',
        'Eating Out': 'HMSHOST',
        'Holiday:Accommodation': 'MOXY STRATFORD',
        'Holiday:Travel': /Trainline|WIZZ AIR|LOT INTERNET POLAND/,
    })),
    eating_out: foursquareCategory({
        'Fast Food Restaurant': 'Food:Takeaway',
        'Fried Chicken Joint':  'Food:Takeaway',
    }, 'Food:Eating Out'),
    shopping: foursquareCategory({
        'Art Museum': 'Holiday:Souvenirs',
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
        'Clothing': /MULBERRY|SELFRIDGES|HARRODS|JCHOOLIM|LPP|Polo Factory Store|HARVEY NICHOLS|INTIMISSIMI/,
        'House:Improvement': 'SCREWFIX',
    })),
    cash: lookup('local_currency', currencies, function (transaction) {
        if (transaction.counterparty.user_id) {
            return 'Loan';
        }
    }),
    transport: foursquareCategory({
        'Gas Station': 'Car:Petrol',
        'Gas Station / Garage': 'Car:Petrol',
        'Parking': 'Car:Parking',
        'Train Station': 'Travel:Rail',
    }, lookup('description', {
        'Car:Parking': /NCP |CAR PARK|MANCHESTER AIRPORT|DONCASTER SHEFFIEL/,
        'Car:Petrol': /EG HOLLINWOOD|MFG  PHOENIX|LOTOS|TESCO PFS|ADEL SF/,
        'Holiday:Travel': /RYANAIR/,
        'Travel:Bus': /AUT BILET|MPSA|MEGABUS/,
        'Travel:Rail': /GVB|Trainline\.com|TFL.gov/i,
        'Travel:Taxi': /UBER|bolt\.eu/i,
    })),
    family: foursquareCategory({
        'Garden Center': 'House:Garden',
        'Pet Store': 'Pet Care',
        'Supermarket': 'House',
        'Warehouse Store': 'House',
    }, lookup('description', {
        'House:Improvement': 'B & Q',

    })),
};

function transfer(transaction, config) {
    if (transaction.counterparty &&
        transaction.counterparty.sort_code &&
        transaction.counterparty.account_number
    ) {
        var key = transaction.counterparty.sort_code.match(/\d{2}/g).join('-')
                + ' ' + transaction.counterparty.account_number;

        if (config.transfers[key]) {
            return config.transfers[key];
        }
    }

    if (transaction.counterparty && config.transfers[transaction.counterparty.user_id]) {
        return config.transfers[transaction.counterparty.user_id];
    }

    if (transaction.merchant && config.transfers[transaction.merchant.group_id]) {
        return config.transfers[transaction.merchant.group_id];
    }

    if (transaction.merchant && transaction.merchant.atm) {
        var account = lookup('local_currency', currencies)(transaction);

        if (!account) {
            console.error('Unknown withdrawn currency', transaction.local_currency);
        }

        return account;
    }

    if (transaction.category == 'mondo' &&
        transaction.amount > 0 &&
        !transaction.counterparty.user_id
        && transaction.is_load
    ) {
        return 'Current Account';
    }
}

function lookup(key, matches, defaultValue) {
    return function (transaction) {
        var isFunction   = (typeof defaultValue === 'function'),
            defaultFunc  = (isFunction ? defaultValue : function () {}),
            defaultValue = (isFunction ? null : defaultValue);

        return defaultFunc(transaction) || Object.keys(matches).find(function (match) {
            var pattern = matches[match],
                value = transaction[key];

            return (pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern));
        }) || defaultValue || '';
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

function timestamp(date) {
    return date ? date + 'T00:00:00Z' : undefined;
}

function date(timestamp) {
    return timestamp.substr(0, 10);
}

function category(transaction) {
    var category = (categories.hasOwnProperty(transaction.category)
                 ? categories[transaction.category]
                 : transaction.category);

    if (typeof category == 'function') {
        category = category(transaction);
    }

    return category;
}

function payee(transaction, config) {
    // use known payee name if we have one
    if (transaction.counterparty.user_id) {
        if (config.payees[transaction.counterparty.user_id]) {
            return config.payees[transaction.counterparty.user_id];
        }

        if (!/^anonuser_/.test(transaction.counterparty.user_id) && !transfer(transaction, config)) {
            return transaction.counterparty.name;
        }
    }

    if (transaction.merchant && transaction.merchant.id) {
        if (config.payees[transaction.merchant.id]) {
            return config.payees[transaction.merchant.id];
        }

        if (config.payees[transaction.merchant.group_id]) {
            return config.payees[transaction.merchant.group_id];
        }

        if (!transfer(transaction, config)) {
            console.log(
                'Unknown merchant',
                transaction.merchant.id + ':' + transaction.merchant.group_id + ':' + date(transaction.created) + ':',
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

    return accounts.filter(a => a.type == typeMap[type])[0];
}

auth.login({
    forceLogin: args.login,
    fakeLogin: args.load
}).then(function (config) {
    function transactionMap(transaction) {
        if (
            transaction.decline_reason // failed
            || !transaction.amount // zero amount transaction
            || (args.topup === false && transaction.is_load && !transaction.counterparty.user_id && transaction.amount > 0) // ignore topups
            || (args.pot === false && transaction.scheme == 'uk_retail_pot') // ignore pot
        ) {
            return false;
        }

        return {
            date:        date(transaction.created),
            amount:      transaction.amount,
            memo:        (transaction.notes || transaction.description.replace(/ +/g, ' ')),
            payee:       payee(transaction, config),
            transfer:    transfer(transaction, config),
            category:    (category(transaction) || ''),
            id:          transaction.id,
            currency:    transaction.local_currency,
            localAmount: transaction.local_amount,
            rate:        (transaction.currency === transaction.local_currency ? 1 : transaction.amount / transaction.local_amount)
        };
    }

    var exporter = Exporter({
        format:  args.format || 'qif',
        name:    'monzo',
        account: 'Monzo'
    });

    if (args.load) {
        return fs.readFile(args.load, 'utf8', function (err, data) {
            exporter.write(JSON.parse(data).map(transactionMap));
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

            return exporter.write(response.transactions.map(transactionMap));
        }).catch(function (resp) {
            if (resp.error && resp.error.code == 'forbidden.verification_required') {
                return console.error('Cannot query older transactions - please refresh permissions in the Monzo app');
            }

            return exit('transactions')(resp);
        });
    }).catch(exit('accounts'));
}).catch(exit('token'));
