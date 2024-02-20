module.exports = async function qif(transactions, options) {
    if (!transactions.length) { return ''; }

    // @todo support multiple accounts
    var head = [
        '!Account',
        'N' + (transactions[0].getAccount() || 'Bank'),
        'TBank',
        '^',
        '!Type:Bank'
    ];

    return transactions.reduce((file, transaction) => {
        return file.concat([
            'D' + transaction.getDate('YYYY-MM-DD'),
            'T' + transaction.getLocalAmount(),
            'M' + transaction.getMemo(),
            'P' + transaction.getPayee(),
            'L' + (transaction.isTransfer() ? '[' + transaction.getTransfer() + ']' : transaction.getCategory() || ''),
            'N' + transaction.getId(),
            '^'
        ]);
    }, head).join('\n');
};
