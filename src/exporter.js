var fs = require('fs').promises,
    adapter, filename;

module.exports = function exporter(options) {
    if (!options.format || !/^[a-z]+$/.test(options.format)) {
        throw new Error('Missing/invalid export format');
    }

    if (options.dump) {
        options.file = options.dump;
        options.format = 'json';
    }

    if (options.store) {
        options.file = options.store;
        options.format = 'store';
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
        options,
        write: async transactions => {
            options.logger.info('Exporting to file', {filename, type: options.format});
            if (!options.dump) { transactions = transactions.filter(t => t && t.isValid && t.isValid()); }

            const contents = await adapter(transactions, options);

            if (contents) {
                await fs.writeFile(filename, contents);
                options.logger.verbose('Wrote ' + transactions.length + ' transactions to ' + filename);
            }
        }
    };
};
