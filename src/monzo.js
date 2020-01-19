const fs = require('fs'),
    monzo = require('monzo-bank'),
    Exporter = require('./exporter'),
    Transaction = require('./transaction');

const auth = require('./lib/auth');
const Yargs = require('yargs');
const args = Yargs
    .option('account',  {alias: 'a', describe: 'Which account to load', default: 'current', choices: ['prepaid', 'current', 'joint', 'all'], type: 'array'})
    .option('format',   {alias: 'o', describe: 'Output format',         default: 'qif',     choices: ['qif', 'csv']})
    .option('from',     {alias: 'f', describe: 'Earliest date for transactions'})
    .option('to',       {alias: 't', describe: 'Latest date for transactions'})
    .option('no-topup', {            describe: 'Don’t include topup transactions'})
    .option('login',    {alias: 'l', describe: 'Force OAuth re-login'})
    .option('dump',     {alias: 'd', describe: 'Dump transactions to specified file'})
    .option('load',     {alias: 'u', describe: 'Load from a specified dump file'})
    .option('quiet',    {alias: 'q', describe: 'Suppress output'})
    .coerce('account',  function (account) {
        if (account.length == 1 && account[0] == 'all') {
            // remove 'all' option and send the rest
            return Yargs.getOptions().choices.account.slice(0, -1);
        }

        return account;
    })
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
        'Garden Center': 'House:Garden',
        'Gift Shop': 'Gifts',
        'Grocery Store': 'Food:Groceries',
        'Jewelry Store': 'Gifts',
        'Miscellaneous Shop': 'House',
        'Sporting Goods Shop': 'Sporting Goods',
        'Supermarket': 'House', // not groceries
        'Warehouse Store': 'House',
        'Women\'s Store': 'Clothing',
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
        'Government Building': 'Car:Parking', // e.g. City of York parking
        'Parking': 'Car:Parking',
        'Train': 'Travel:Rail',
        'Train Station': 'Travel:Rail',
    }, lookup('description', {
        'Car:Parking': /NCP |CAR PARK|MANCHESTER AIRPORT|DONCASTER SHEFFIEL|LeedsCityCouncil|CITY OF YORK COUNC/i,
        'Car:Petrol': /EG HOLLINWOOD|MFG  PHOENIX|LOTOS|TESCO PFS|ADEL SF|PAY AT PUMP|PETROL|MALTHURST LIMITED|ESSO/,
        'Car:Service & MOT': 'R H SIRRELL',
        'Holiday:Travel': /RYANAIR/,
        'Travel:Bus': /AUT BILET|MPSA|MEGABUS|STAGECOACH SERVICE/,
        'Travel:Rail': /GVB|Trainline|TFL.gov/i,
        'Travel:Taxi': /UBER|bolt\.eu|AMBER/i,
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

const accountTypeMap = {
    joint: 'uk_retail_joint',
    current: 'uk_retail',
    prepaid: 'uk_prepaid'
};

const pots = {};

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

function accounts(accounts, types) {
    return accounts.filter(a => types.map(t => accountTypeMap[t]).includes(a.type));
}

auth.login({
    forceLogin: args.login,
    fakeLogin: args.load
}).then(function (config) {
    let connector = {
        warn,
        config,
        categories,
        pots,
        foreignCurrencies,
        args,
    };

    const exporter = Exporter({
        format:  args.format || 'qif',
        quiet:   args.quiet,
        name:    'monzo',
    });

    monzo.pots(config.token.access_token).then(function (potsResponse) {
        potsResponse.pots.map(pot => pots[pot.id] = pot);

        monzo.accounts(config.token.access_token).then(function (accountsResponse) {
            // map of account IDs to names
            const accountNames = accountsResponse.accounts.reduce(function (names, account) {
                const type = Object.keys(accountTypeMap).find(t => accountTypeMap[t] == account.type);
                names[account.id] = 'Monzo ' + type.replace(/^./, c => c.toUpperCase());
                return names;
            }, {});

            function write(transactions) {
                if (args.dump) {
                    return Exporter({format: 'json', file: args.dump}).write(transactions);
                }

                exporter.write(transactions.map(function (raw) {
                    const transaction = new Transaction(accountNames[raw.account_id], raw, connector);
                    return (transaction.isValid() ? transaction : false);
                }).filter(Boolean), function () {
                    potsResponse.pots.map(function (pot) {
                        if (!pot.deleted && pot.round_up) {
                            console.log(
                                'Your Monzo balance includes a pot "' + pot.name + '" containing',
                                exporter.helpers.numberFormat(pot.balance, pot.currency),
                                pot.currency
                            );
                        }
                    });
                });
            }

            // load from dump file
            if (args.load) {
                return fs.readFile(args.load, 'utf-8', function (err, data) {
                    if (err) { return exit('dumpfile')(err); }
                    write(JSON.parse(data));
                });
            }

            accounts(accountsResponse.accounts, args.account).reduce(async function (previousPromise, account) {
                let transactions = await previousPromise;

                return new Promise(function (resolve, reject) {
                    monzo.transactions({
                      account_id: account.id,
                      expand:     'merchant',
                      since:      timestamp(args.from),
                      before:     timestamp(args.to)
                    }, config.token.access_token).then(function (transactionsResponse) {
                        resolve(transactions.concat(transactionsResponse.transactions));
                    }).catch(function (resp) {
                        if (resp.error && resp.error.code == 'forbidden.verification_required') {
                            return reject('Cannot query older transactions - please refresh permissions in the Monzo app');
                        }

                        reject(resp);
                    });
                });
            }, Promise.resolve([])).then(write).catch(exit('transactions'));
        }).catch(exit('pots'));
    }).catch(exit('accounts'));
}).catch(exit('token'));
