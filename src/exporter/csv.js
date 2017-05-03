module.exports = function csv(transactions, options) {
    var separator = options.separator || ',';

    var head = [
        'Date',
        'Payee',
        'Amount',
        'Category',
        'Currency',
        'Rate',
        'Comments',
        'Number',
    ].join(separator);

    return transactions.reduce(function (file, transaction) {
        return file.concat([
            transaction.date,
            transaction.payee,
            (transaction.localAmount / 100).toFixed(2),
            transaction.category,
            transaction.currency || '',
            transaction.rate || 1,
            transaction.memo,
            transaction.id
        ].join(separator));
    }, [head]).join('\n');
};
