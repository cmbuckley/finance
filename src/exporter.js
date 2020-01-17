var fs = require('fs'),
    adapter, filename;

var decimalExceptions = {JPY: 0};
var helpers = {
    decimals: function (currency) {
        return (decimalExceptions.hasOwnProperty(currency) ? decimalExceptions[currency] : 2);
    },
    exchangeRate: function (localAmount, localCurrency, amount, currency) {
        if (localCurrency == currency) { return 1; }
        return Math.pow(10, helpers.decimals(localCurrency) - helpers.decimals(currency)) * amount / localAmount;
    },
    numberFormat: function (amount, currency) {
        var decimals = helpers.decimals(currency);
        return (amount / Math.pow(10, decimals)).toFixed(decimals);
    }
};

module.exports = function exporter(options) {
    if (!options.format || !/^[a-z]+$/.test(options.format)) {
        throw new Error('Missing/invalid export format');
    }

    try {
        adapter = require('./exporter/' + options.format);
    } catch (e) {
        if (e.code == 'MODULE_NOT_FOUND') {
            throw new Error(options.format + ': format not found');
        }

        throw e;
    }

    if (!options.name && !options.file) {
        throw new Error('Missing file name');
    }

    filename = options.file ? options.file : [
        options.name,
        adapter.extension || options.format
    ].join('.');

    return {
        helpers: helpers,
        write: function (transactions, callback) {
            if (!options.quiet) { console.log('Exporting to', filename); }

            adapter.call(helpers, transactions, options, function (err, contents) {
                fs.writeFile(filename, contents, function () {
                    if (!options.quiet) { console.log('Wrote ' + transactions.length + ' transactions to', filename); }
                    callback && callback(contents);
                });
            });
        }
    };
};
