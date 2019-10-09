var fs = require('fs'),
    adapter, filename;

module.exports = function exporter(options) {
    if (!options.format || !/^[a-z]+$/.test(options.format)) {
        throw new Error('Missing/invalid export format');
    }

    try {
        adapter = require('./exporter/' + options.format);
    } catch (e) {
        throw new Error(options.format + ': format not found');
    }

    if (!options.name && !options.file) {
        throw new Error('Missing file name');
    }

    filename = options.file ? options.file : [
        options.name,
        adapter.extension || options.format
    ].join('.');

    return {
        write: function (transactions) {
            if (!options.quiet) { console.log('Exporting to', filename); }

            adapter(transactions.filter(Boolean), options, function (err, contents) {
                fs.writeFile(filename, contents, function () {
                    if (!options.quiet) { console.log('Wrote transactions to', filename); }
                });
            });
        }
    };
};
