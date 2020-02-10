const monzo = require('monzo-bank'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/monzo');

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

var helpers = {
    decimalExceptions: {JPY: 0},
    decimals: function (currency) {
        return (this.decimalExceptions.hasOwnProperty(currency) ? this.decimalExceptions[currency] : 2);
    },
    exchangeRate: function (localAmount, localCurrency, amount, currency) {
        if (localCurrency == currency) { return 1; }
        return Math.pow(10, this.decimals(localCurrency) - this.decimals(currency)) * amount / localAmount;
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
    }

    addConfig(accountConfig) {
        this.accountMap[accountConfig.account] = accountConfig.name;
    }

    async getTransactions(from, to) {
        let accessToken = this.getAccessToken(),
            potsResponse = await monzo.pots(accessToken);

        let connector = {
            categories,
            pots,
            foreignCurrencies,
            config: this.config,
        };

        potsResponse.pots.map(function (pot) {
            pots[pot.id] = pot;

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
                    return new Transaction(accountMap[account.type] || account.display_name, raw, adapter, connector);
                })));
            });
        }, Promise.resolve([]));

        return transactions;
    }
}

module.exports = MonzoAdapter;
