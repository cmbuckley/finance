function head(account) {
    return [
        '!Account',
        'N' + (account || 'Bank'),
        'TBank',
        '^',
        '!Type:Bank'
    ];
}

module.exports = async function qif(transactions, options) {
    if (!transactions.length) { return ''; }

    // group transactions by account name
    const groupedTransactions = transactions.reduce((acc, transaction) => {
        const account = transaction.getAccount();
        acc[account] ??= [];
        acc[account].push(transaction);
        return acc;
    }, {});

    return Object.entries(groupedTransactions).map(([account, transactions]) => {
        return head(account).concat(transactions.map(transaction => [
            'D' + transaction.getDate('YYYY-MM-DD'),
            'T' + transaction.getLocalAmount(),
            'M' + transaction.getMemo(),
            'P' + transaction.getPayee(),
            'L' + (transaction.isTransfer() ? '[' + transaction.getTransfer() + ']' : transaction.getCategory() || ''),
            'N' + transaction.getId(),
            '^'
        ]).flat());
    }).flat().join('\n');
};
