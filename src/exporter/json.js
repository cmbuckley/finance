module.exports = function json(transactions, options, callback) {
    callback(null, JSON.stringify(transactions, null, options.indent || 2));
};
