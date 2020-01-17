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

        // duplicate the row for the transfer
        if (transaction.isTransfer()) {
            let transfer = row.slice(0);
            if (transaction.isCashWithdrawal()) { transfer[head.indexOf('Rate')] = 1; }
            transfer[head.indexOf('Account')] = transaction.getTransfer();
            transfer[head.indexOf('Amount')] = transaction.getLocalAmount(true);
            transfer[head.indexOf('Category')] = 'Transfer ' + (transaction.isDebit() ? 'from' : 'to') + ':' + transaction.getAccount();
            row[head.indexOf('Category')] = 'Transfer ' + (transaction.isDebit() ? 'to' : 'from') + ':' + transaction.getTransfer();
            rows.push(transfer);
        }

        rows.push(row);
        return rows;
    }.bind(this), [head]), {
        delimiter: options.delimiter
    }, callback);
};
