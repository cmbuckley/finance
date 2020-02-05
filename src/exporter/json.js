module.exports = function json(transactions, options, callback) {
    callback(null, JSON.stringify(transactions.map(t => t.raw), null, options.indent || 2));
};
