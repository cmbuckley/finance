const Adapter = require('../adapter'),
    Transaction = require('../transaction/pokerstars');

class PokerStarsAdapter extends Adapter {
    constructor(accountPath, config, logger) {
        super(accountPath, config, logger);
    }

    async login(options) {
    }

    async getTransactions(from, to) {
    }
}

module.exports = PokerStarsAdapter;
