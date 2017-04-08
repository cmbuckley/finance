module.exports = function qif(transactions, options) {
    var head = [
        '!Account',
        'N' + (options.account || 'Bank'),
        'TBank',
        '^',
        '!Type:Bank'
    ];

    return transactions.reduce(function (file, transaction) {
        return file.concat([
            'D' + transaction.date,
            'T' + (transaction.amount / 100).toFixed(2),
            'M' + transaction.memo,
            'P' + transaction.payee,
            'L' + transaction.category,
            'N' + transaction.id,
            '^'
        ]);
    }, head).join('\n');
};
