const fs = require('fs'),
    Adapter = require('../adapter'),
    TruelayerTransaction = require('../transaction/truelayer'),
    MonzoTransaction = require('../transaction/monzo');

class LoadAdapter extends Adapter {

    constructor(file) {
        super();
        this.file = file;
    }

    async login(options) {
        return Promise.resolve();
    }

    async getTransactions() {
        return new Promise(function (res, rej) {
            // @todo fs.promises API in v10
            fs.readFile(this.file, 'utf-8', function (err, contents) {
                if (err) { return rej(err); }

                res(JSON.parse(contents).map(function (data) {
                    const Transaction = (data.raw.transaction_id ? TruelayerTransaction : MonzoTransaction);
                    return new Transaction(data.account, data.raw); // @todo needs helpers support
                }));
            });
        }.bind(this));
    }
}

module.exports = LoadAdapter;
