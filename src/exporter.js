var fs = require('fs'),
    adapter, filename;

module.exports = function exporter(options) {
    if (!options.format || !/^[a-z]+$/.test(options.format)) {
        throw new Error('Missing/invalid export format');
    }

    if (options.dump) {
        options.file = options.dump;
        options.format = 'json';
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
        write: function (transactions, callback) {
            if (!options.quiet) { options.logger.info('Exporting to file', {filename, type: options.format}); }
            if (!options.dump) { transactions = transactions.filter(t => t && t.isValid && t.isValid()); }

            adapter(transactions, options, function (err, contents) {
                fs.writeFile(filename, contents, function () {
                    options.logger.verbose('Wrote ' + transactions.length + ' transactions to ' + filename);
                    callback && callback(contents);
                });
            });
        }
    };
};
