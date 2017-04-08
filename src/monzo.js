var fs = require('fs'),
    monzo = require('monzo-bank'),
    args = require('yargs').argv,
    Exporter = require('./exporter');

var categories = {
    general:       '', // TODO inspect
    eating_out:    'Food:Eating Out',
    expenses:      'Job Expenses', // TODO expand
    bills:         'Bills',
    entertainment: 'Nights Out',
    groceries:     'Food:Groceries',
    holidays:      '', // TODO inspet

    shopping:      function (transaction) {
        if (transaction.merchant && transaction.merchant.metadata) {
            switch (transaction.merchant.metadata.foursquare_category) {
                case 'Gift Shop':
                    return 'Gifts';
            }
        }
    },
    cash: lookup('local_currency', {
        '[Cash]':  'GBP',
        '[Euros]': 'EUR',
        '[Złoty]': 'PLN'
    }, function (transaction) {
        if (transaction.counterparty.user_id) {
            return 'Loan';
        }
    }),
    transport: lookup('description', {
        'Car:Parking': /NCP LIMITED|CAR PARK/
    }),
    mondo: function (transaction) {
        return (transaction.amount > 0 && !transaction.counterparty.user_id && transaction.is_load ? '[Current Account]' : '');
    }
};

var users = {
    'user_00009AJ5zA1joAasHukGHp': 'Emilia Lewandowska'
};

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

function exit(scope) {
    return function (err) {
        console.error('Error with', scope, '-', err);
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

    // some transactions are missing names
    if (transaction.counterparty.user_id && users[transaction.counterparty.user_id]) {
        return users[transaction.counterparty.user_id];
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
        var exporter = Exporter({
            format:  args.format || 'qif',
            name:    'monzo',
            account: 'Monzo'
        });

        exporter.write(response.transactions.map(function (transaction) {
            if (
                transaction.decline_reason // failed
                || !transaction.amount // zero amount transaction
                || (args.topup === false && transaction.is_load && !transaction.counterparty.user_id) // ignore topups
            ) {
                return false;
            }

            return {
                date:        date(transaction.created),
                amount:      transaction.amount,
                memo:        (transaction.notes || transaction.description.replace(/ +/g, ' ')),
                payee:       payee(transaction),
                category:    (category(transaction) || ''),
                id:          transaction.dedupe_id,
                currency:    transaction.local_currency,
                localAmount: transaction.local_amount,
                rate:        (transaction.currency === transaction.local_currency ? 1 : transaction.amount / transaction.local_amount)
            };
        }));

    }).catch(exit('transactions'));
}).catch(exit('accounts'));
