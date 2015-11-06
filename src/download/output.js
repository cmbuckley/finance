var accounts = [],
    transfers = {
        'Cash':            /^CASH/,
        'Credit Card':     'HSBC CREDIT CARD',
        'Current Account': /^404401 [0-9]{4}5471/,
        'HSBC ISA':        /^404401 [0-9]{4}3752|BUCKLEY C   \*LYA/,
        'Mortgage':        /MTG 400188[0-9]{4}9172/,
        'PayPal':          'PAYPAL',
        'Payslips':        'SKY UK LIMITED'
    };

exports.load = function (content) {
    content.split(/!Account\n/).filter(Boolean).map(function (account) {
        var index = account.indexOf('!');
        this.add(account.substring(1, index - 9), account.substring(index));
    }, this);
};

exports.add = function (accountName, transactions) {
    accounts.push({
        name:         accountName,
        transactions: transactions
    });
};

exports.get = function () {
    var output = accounts.map(function (account) {
        return '!Account\nN' + account.name + '\nTBank\n^\n' + account.transactions;
    }).join('\n');

    return output.split('\n').map(function (line) {
        var memo, account, output = '';

        if (line[0] == 'P' || line[0] == 'M') {
            memo = line.substr(1);

            for (acct in accounts) {
                if (accounts[acct].test && accounts[acct].test(memo) || accounts[acct] == memo) {
                    output = 'L[' + acct + ']\n';
                }
            }

            output += 'M' + memo;
        }
        else if (line[0] == 'D') {
            output = 'D' + line.substr(1).split('/').reverse().join('/');
        }
        else if (line[0] != 'L') {
            output = line;
        }

        return output;
    }).filter(Boolean).join('\n');
};
