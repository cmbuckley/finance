var stringify = require('csv-stringify');

module.exports = function csv(transactions, options, callback) {
    var head = [
        'Date',
        'Payee',
        'Amount',
        'Category',
        'Currency',
        'Rate',
        'Comments',
        'Number',
    ];

    stringify([head].concat(transactions.map(function (transaction) {
        return [
            transaction.date,
            transaction.payee,
            (transaction.localAmount / 100).toFixed(2),
            transaction.category,
            transaction.currency || '',
            transaction.rate || 1,
            transaction.memo,
            transaction.id
        ];
    })), {
        delimiter: options.delimiter
    }, callback);
};
