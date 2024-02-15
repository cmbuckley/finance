const fs = require('fs'),
    Adapter = require('../adapter');

class LoadAdapter extends Adapter {

    constructor(file, logger) {
        super(null, null, logger);
        this.file = file;
    }

    async login(options) {
        return Promise.resolve();
    }

    _getTransaction(className) {
        return require('../transaction/' + className.replace('Transaction', '').toLowerCase());
    }

    async getTransactions() {
        let adapter = this;

        return new Promise(function (res, rej) {
            // @todo fs.promises API in v10
            fs.readFile(this.file, 'utf-8', function (err, contents) {
                if (err) { return rej(err); }

                res(JSON.parse(contents).map(function (data) {
                    const Transaction = adapter._getTransaction(data.type);
                    return new Transaction(data.account, data.raw, adapter, adapter.logger.child({module: data.module})); // @todo adapter needs Monzo pots support
                }));
            });
        }.bind(this));
    }
}

module.exports = LoadAdapter;
