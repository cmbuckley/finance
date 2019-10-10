var stringify = require('csv-stringify');

module.exports = function csv(transactions, options, callback) {
    var head = [
        'Account',
        'Date',
        'Payee',
        'Amount',
        'Category',
        'Currency',
        'Rate',
        'Notes',
        'Number',
    ];

    stringify(transactions.reduce(function (rows, transaction) {
        let row = [
            options.account,
            transaction.date,
            transaction.payee,
            (transaction.localAmount / 100).toFixed(2),
            transaction.category,
            transaction.currency || '',
            transaction.rate || 1,
            transaction.memo,
            transaction.id
        ];

        // duplicate the row for the transfer
        if (transaction.transfer) {
            let transfer = row.slice(0);
            transfer[head.indexOf('Account')] = transaction.transfer;
            transfer[head.indexOf('Amount')] = (-transaction.localAmount / 100).toFixed(2);
            transfer[head.indexOf('Category')] = 'Transfer ' + (transaction.localAmount < 0 ? 'from' : 'to') + ':' + options.account;
            row[head.indexOf('Category')] = 'Transfer ' + (transaction.localAmount > 0 ? 'from' : 'to') + ':' + transaction.transfer;
            rows.push(transfer);
        }

        rows.push(row);
        return rows;
    }, [head]), {
        delimiter: options.delimiter
    }, callback);
};
