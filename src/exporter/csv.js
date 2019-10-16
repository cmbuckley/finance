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
            transaction.date.format('YYYY-MM-DD HH:mm'),
            transaction.payee,
            this.numberFormat(transaction.localAmount, transaction.localCurrency || ''),
            transaction.category,
            transaction.localCurrency || '',
            this.exchangeRate(transaction.localAmount, transaction.localCurrency, transaction.amount, transaction.currency),
            transaction.memo,
            transaction.id
        ];

        // duplicate the row for the transfer
        if (transaction.transfer) {
            let transfer = row.slice(0);
            if (transaction.atm) { transfer[head.indexOf('Rate')] = 1; }
            transfer[head.indexOf('Account')] = transaction.transfer;
            transfer[head.indexOf('Amount')] = this.numberFormat(-transaction.localAmount, transaction.localCurrency || '');
            transfer[head.indexOf('Category')] = 'Transfer ' + (transaction.localAmount < 0 ? 'from' : 'to') + ':' + options.account;
            row[head.indexOf('Category')] = 'Transfer ' + (transaction.localAmount > 0 ? 'from' : 'to') + ':' + transaction.transfer;
            rows.push(transfer);
        }

        rows.push(row);
        return rows;
    }.bind(this), [head]), {
        delimiter: options.delimiter
    }, callback);
};
