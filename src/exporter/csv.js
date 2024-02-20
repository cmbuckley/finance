const { stringify } = require('csv-stringify');

module.exports = async function csv(transactions, options) {
    const head = [
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

    return new Promise((resolve, reject) => {
        stringify(transactions.reduce((rows, transaction) => {
            let row = [
                transaction.getAccount(),
                transaction.getDate('YYYY-MM-DD HH:mm', options.timezone || 'Europe/London'),
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
                row[head.indexOf('Payee')] = '';
            }

            rows.push(row);
            return rows;
        }, [head]), {
            delimiter: options.delimiter
        }, (err, output) => (err ? reject(err) : resolve(output)));
    });
};
