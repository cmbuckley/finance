var fs = require('fs'),
    monzo = require('mondo-bank'),
    args = require('yargs').argv;

var categories = {
    general:       '', // TODO inspect
    eating_out:    'Food:Eating Out',
    expenses:      'Job Expenses', // TODO expand
    bills:         'Bills',
    entertainment: 'Nights Out',
    groceries:     'Food:Groceries',
    shopping:      '', // TODO inspect
    holidays:      '', // TODO inspet

    cash: lookup('local_currency', {
        '[Cash]':  'GBP',
        '[Euros]': 'EUR'
    }),
    transport: lookup('description', {
        'Car:Parking': 'NCP LIMITED'
    }),
    mondo: function (transaction) {
        return (transaction.metadata.is_topup ? '[Current Account]' : '');
    }
};

function lookup(key, matches, defaultValue) {
    return function (transaction) {
        return Object.keys(matches).find(function (match) {
            var pattern = matches[match],
                value = transaction[key];

            return (pattern instanceof RegExp ? pattern.test(value) : value.includes(pattern));
        }) || defaultValue || '';
    };
}

function exit(scope) {
    return function (err) {
        console.error('Error with', scope, err);
        throw new Error(err.error.message);
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
    if (transaction.counterparty.name) {
        return transaction.counterparty.name;
    }

    return '';
}

monzo.accounts(args.token).then(function (response) {
    monzo.transactions({
      account_id: response.accounts[0].id,
      expand:     'merchant',
      since:      timestamp(args.from),
      before:     timestamp(args.to)
    }, args.token).then(function (response) {
        var head = [
            '!Account',
            'NMonzo',
            'TBank',
            '^',
            '!Type:Bank'
        ];

        var qif = response.transactions.reduce(function (file, transaction) {
            if (
                transaction.decline_reason // failed
                || (args.topup === false && transaction.metadata.is_topup) // ignore topups
            ) {
                return file;
            }

            return file.concat([
                'D' + date(transaction.created),
                'T' + (transaction.amount / 100).toFixed(2),
                'M' + (transaction.notes || transaction.description.replace(/ +/g, ' ')),
                'P' + payee(transaction),
                'L' + category(transaction),
                'N' + transaction.dedupe_id,
                '^'
            ]);
        }, head).join('\n');

        fs.writeFileSync('monzo.qif', qif);
        console.log('Wrote transactions to monzo.qif');
    }).catch(exit('transactions'));
}).catch(exit('accounts'));
