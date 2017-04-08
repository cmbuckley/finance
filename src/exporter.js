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

    if (!options.name) {
        throw new Error('Missing file name');
    }

    filename = [
        options.name,
        adapter.extension || options.format
    ].join('.');

    return {
        write: function (transactions) {
            fs.writeFileSync(filename, adapter(transactions.filter(Boolean), options));
            console.log('Wrote transactions to ' + filename);
        }
    };
};