module.exports = function csv(transactions, options) {
    var separator = options.separator || ',';

    var head = [
        'Date',
        'Name',
        'Amount',
        'Currency',
        'Rate'
    ].join(separator);

    return transactions.reduce(function (file, transaction) {
        return file.concat([
            transaction.date,
            transaction.payee,
            (transaction.localAmount / 100).toFixed(2),
            transaction.currency || '',
            transaction.rate || 1
        ].join(separator));
    }, [head]).join('\n');
};
