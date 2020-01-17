module.exports = function qif(transactions, options, callback) {
    if (!transactions.length) { return callback(null); }

    var head = [
        '!Account',
        'N' + (transactions[0].getAccount() || 'Bank'),
        'TBank',
        '^',
        '!Type:Bank'
    ];

    callback(null, transactions.reduce(function (file, transaction) {
        return file.concat([
            'D' + transaction.getDate('YYYY-MM-DD'),
            'T' + transaction.getLocalAmount(),
            'M' + transaction.getMemo(),
            'P' + transaction.getPayee(),
            'L' + (transaction.isTransfer() ? '[' + transaction.getTransfer() + ']' : transaction.getCategory() || ''),
            'N' + transaction.getId(),
            '^'
        ]);
    }, head).join('\n'));
};
