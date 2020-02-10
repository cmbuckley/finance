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
            transaction.getAccount(),
            transaction.getDate('YYYY-MM-DD HH:mm'),
            transaction.getPayee(),
            transaction.getLocalAmount(),
            transaction.getCategory(),
            transaction.getCurrency(),
            transaction.getExchangeRate(),
            transaction.getMemo(),
            transaction.getId()
        ];

        if (transaction.isTransfer()) {
            row[head.indexOf('Category')] = 'Transfer ' + (transaction.isDebit() ? 'to' : 'from') + ':' + transaction.getTransfer();
        }

        rows.push(row);
        return rows;
    }, [head]), {
        delimiter: options.delimiter
    }, callback);
};
