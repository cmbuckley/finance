var fs = require('fs'),
    monzo = require('monzo-bank'),
    args = require('yargs').argv,
    Exporter = require('./exporter');

monzo.setHost('https://internal-api.monzo.com');

var categories = {
    general:       '', // TODO inspect
    expenses:      'Job Expenses', // TODO expand
    bills:         'Bills',
    entertainment: 'Nights Out',
    groceries:     'Food:Groceries',
    holidays:      '', // TODO inspet

    eating_out: foursquareCategory({
        'Fried Chicken Joint':  'Food:Takeaway',
        'Fast Food Restaurant': 'Food:Takeaway',
    }, 'Food:Eating Out'),
    shopping: foursquareCategory({
        'Gift Shop':  'Gifts',
    }),
    cash: lookup('local_currency', {
        'Cash':  'GBP',
        'Euros': 'EUR',
        'Złoty': 'PLN'
    }, function (transaction) {
        if (transaction.counterparty.user_id) {
            return 'Loan';
        }
    }),
    transport: lookup('description', {
        'Car:Parking': /NCP LIMITED|CAR PARK|YOURPARKINGSPACECOUK/,
        'Car:Petrol':  /MALTHURST LIMITED/,
        'Travel:Taxi': /UBER/,
    })
};

var transfers = {
    '40-47-62 XXXX6141': 'Shared Account',
    '40-44-01 XXXX5471': 'Current Account',
    '23-52-62 XXXX9595': 'PayPal',

    'grp_000092YBvG5KUEHWvN82gz': 'PayPal',
};

var payees = {
    'user_00009AJ5zA1joAasHukGHp':  'Emilia Lewandowska',
    'user_000096wneGBzTkXmQ30qiP':  'Marc Easen',
    'user_000096bGKmot5HcrIDKhCz':  'Craig Lumley',
    'user_000098VBRbmovokAtMyQtd':  'James Starnes',
    'user_00009E08wLax8TDl4Egi01':  'Kameil Lewis',
    'user_00009LOheaZtAu2IUvNvZB':  'Grace Moran',

    'merch_00009Bg3D0Oad72qvUzIaf': '360 Champagne & Cocktails',
    'merch_000097xkqhwA5jRg7CFfWr': 'Aldi Meanwood',
    'merch_0000990GI2UdIxOHZ0imeH': 'Asda Meanwood',
    'merch_0000988NR1FJWBTmNVhymv': 'Be At One',
    'merch_00009AfKXYRTDHvfIwRkCP': 'Centre Fillings',
    'merch_00009G71vc2vEq6wB5HCzZ': 'Chop’d',
    'merch_000094JaGKXCiLMc07WsgD': 'Co-op West Point',
    'merch_000094JXvvv4K5uk3ZP51d': 'Co-op West Point',
    'merch_00009A4aZnkjfXwJ8n3l2H': 'East Of Arcadia',
    'merch_00009DRKIRqEtFp9lGf59d': 'Greggs West Point',
    'merch_000096r2vn2ExM3jIyEayP': 'Jack-Pots',
    'merch_000098QgS241MGxWmpG0aP': 'KFC Meanwood',
    'merch_00009AOjSpmwUHRbn5pman': 'Lamb and Flag',
    'merch_000097EJ1GK7YcvE25lEsT': 'Lazy Lounge',
    'merch_00009GObREBWI0wRotPFdh': 'Manahatta',
    'merch_00009BDH6FvuECknBk8a3t': 'Meanwood News & Booze',
    'merch_00009ECud6e5cVz8YM1BY1': 'M&S West Point',
    'merch_00009763yUkQQ2TdXVt2Ez': 'NCP Wellington Place',
    'merch_000095vJZbIaLB9GKSHtGD': 'Primark Trinity',
    'merch_000097UehpOkkQ64ajMKXJ': 'Roxy Ball Room',
    'merch_000098VN7LfYLOZEAh2Hcf': 'Sainsbury’s Headingley',
    'merch_000094NTIBzJXTwhrzdPzV': 'Sociable Folk',
    'merch_000097ObP3kJiHGndj0rb7': 'Sociable Folk',
    'merch_00009A1v5OMt01lXXeGNSz': 'Tasty Toasties',
    'merch_0000971JeEhmyxIOu02CK9': 'Tesco Metro Leeds',
    'merch_00009AGs9hSwYET4ndke8H': 'The Brewery Tap',
    'merch_00009EBn96CzmqFMGNWU4X': 'The Central',
    'merch_00009PUDDhjinyInrW6jOD': 'The Wardrobe',
    'merch_000093dFPRryYOLRmI056P': 'Uber',
    'merch_00009GYf1bqa2A3D4jFcS9': 'Veeno',
    'merch_000096mrXRnKOsgt6mLH5l': 'Waitrose Meanwood',
    'merch_000094JfXOmaflIKJZOwKn': 'Wasabi Leeds',

    'grp_000092JYbSIkjviyjwdqtN':   'Amazon',
    'grp_00009FQAj7ylkIBG7G8STh':   'The Good Luck Club',
    'grp_00009FYpfFLo2y28d1sdvN':   'Whitehall Rd Car Park',
};

function transfer(transaction) {
    if (transaction.counterparty &&
        transaction.counterparty.sort_code &&
        transaction.counterparty.account_number
    ) {
        var key = transaction.counterparty.sort_code.match(/\d{2}/g).join('-')
                + ' XXXX' + transaction.counterparty.account_number.substr(-4);

        if (transfers[key]) {
            return transfers[key];
        }
    }

    if (transaction.merchant && transfers[transaction.merchant.group_id]) {
        return transfers[transaction.merchant.group_id];
    }

    if (transaction.category == 'cash') {
        return lookup('local_currency', {
            'Cash':  'GBP',
            'Euros': 'EUR',
            'Złoty': 'PLN'
        })(transaction);
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

        return defaultValue;
    };
}

function exit(scope) {
    return function (err) {
        console.error('Error with', scope);
        console.error(err.stack || err.error);
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


    return ((typeof category == 'function') ? category(transaction) : category);
}

function payee(transaction) {
    // use known payee name if we have one
    if (transaction.counterparty.user_id) {
        if (payees[transaction.counterparty.user_id]) {
            return payees[transaction.counterparty.user_id];
        }

        if (!/^anonuser_/.test(transaction.counterparty.user_id)) {
            console.log(
                'Unknown user',
                transaction.counterparty.user_id + ':',
                transaction.counterparty.name || '',
                transaction.notes ? '(' + transaction.notes + ')' : ''
            );
        }
    }

    if (transaction.merchant && transaction.merchant.id) {
        if (payees[transaction.merchant.id]) {
            return payees[transaction.merchant.id];
        }

        if (payees[transaction.merchant.group_id]) {
            return payees[transaction.merchant.group_id];
        }

        if (!transfer(transaction)) {
            console.log(
                'Unknown merchant',
                transaction.merchant.id + '/' + transaction.merchant.group_id + ':',
                transaction.merchant.name || ''
            );
        }
    }

    return '';
}

monzo.accounts(args.token).then(function (response) {
    monzo.transactions({
      account_id: response.accounts[args.prepaid ? 0 : 1].id, // @todo improve
      expand:     'merchant',
      since:      timestamp(args.from),
      before:     timestamp(args.to)
    }, args.token).then(function (response) {
        var exporter = Exporter({
            format:  args.format || 'qif',
            name:    'monzo',
            account: 'Monzo'
        });

        exporter.write(response.transactions.map(function (transaction) {
            if (
                transaction.decline_reason // failed
                || !transaction.amount // zero amount transaction
                || (args.topup === false && transaction.is_load && !transaction.counterparty.user_id && transaction.amount > 0) // ignore topups
            ) {
                return false;
            }

            return {
                date:        date(transaction.created),
                amount:      transaction.amount,
                memo:        (transaction.notes || transaction.description.replace(/ +/g, ' ')),
                payee:       payee(transaction),
                transfer:    transfer(transaction),
                category:    (category(transaction) || ''),
                id:          transaction.id,
                currency:    transaction.local_currency,
                localAmount: transaction.local_amount,
                rate:        (transaction.currency === transaction.local_currency ? 1 : transaction.amount / transaction.local_amount)
            };
        }));

    }).catch(exit('transactions'));
}).catch(exit('accounts'));
