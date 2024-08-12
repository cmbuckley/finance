const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async function store(transactions, options) {
    // group the transactions by module and year
    const store = transactions.reduce((acc, transaction) => {
        const module = transaction.getModule(),
            year = transaction.getDate().year();

        if (!acc[module]) { acc[module] = {}; }
        if (!acc[module][year]) { acc[module][year] = {}; }

        acc[module][year][transaction.getId()] = transaction;
        return acc;
    }, {});

    try {
        const stat = await fs.stat(options.store);
        if (!stat.isDirectory()) {
            throw new Error(`${options.store}: not a directory`);
        }
    } catch (err) {
        if (err.code != 'ENOENT') {
            throw err;
        }
    }

    for (const [module, data] of Object.entries(store)) {
        await fs.mkdir(path.join(options.store, module), {recursive: true});

        for (let [year, transactions] of Object.entries(data)) {
            const filename = path.join(options.store, module, year + '.json');
            try {
                const existing = require(path.resolve(filename));
                transactions = Object.assign(existing, transactions);
            } catch (err) {
                if (err.code != 'MODULE_NOT_FOUND') {
                    throw err;
                }
            }

            const contents = JSON.stringify(transactions, null, options.indent || 2);
            await fs.writeFile(filename, contents);
        }
    }
};
