module.exports = function json(transactions, options, callback) {
    // unique adapters
    const adapters = transactions.reduce((acc, curr) => {
        const key = curr.adapter.constructor.name.replace('Adapter', '').toLowerCase();
        if (!acc[key]) { acc[key] = curr.adapter; }
        return acc;
    }, {});

    callback(null, JSON.stringify({adapters, transactions}, null, options.indent || 2));
};
