var accounts = [],
    names = {
        'HSBC ADVANCE': 'Current Account',
        'LOY ISA ADV':  'HSBC ISA',
        'MORTGAGE':     'Mortgage',
        'PREF REG SAV': 'Regular Saver',
        'FLEX SAV PRE': 'Flexible Saver'
    },
    transfers = {
        'Cash':            /^CASH/,
        'Credit Card':     'HSBC CREDIT CARD',
        'Flexible Saver':  /^404401 [0-9]{4}6646|BUCKLEY C M \*RSB REGULAR SAVER/,
        'Current Account': /^404401 [0-9]{4}5471|MORTGAGE PAYMENT|BUCKLEY CM|DIRECT DEBIT PAYMENT/,
        'HSBC ISA':        /^404401 [0-9]{4}3752|BUCKLEY C   \*LYA/,
        'Mortgage':        /MTG 400188[0-9]{4}9172/,
        'Monzo':           /MONZO/,
        'PayPal':          /PAYPAL/,
        'Payslips':        'HESTVIEW'
    };

exports.load = function (content) {
    content.split(/!Account\n/).filter(Boolean).map(function (account) {
        // first line of header has account name, and line starting with ! is start of body
        this.add(account.substring(1, account.indexOf('\n')), account.substring(account.indexOf('!')));
    }, this);
};

exports.add = function (accountName, transactions) {
    accounts.push({
        name:         names[accountName] || accountName,
        transactions: transactions
    });
};

exports.get = function () {
    var output = accounts.map(function (account) {
        return '!Account\nN' + account.name + '\nTBank\n^\n' + account.transactions;
    }).join('\n');

    return output.split('\n').map(function (line) {
        var memo, tr, output = '';

        if (line[0] == 'P' || line[0] == 'M') {
            memo = line.substr(1);

            for (tr in transfers) {
                if (transfers[tr].test && transfers[tr].test(memo) || transfers[tr] == memo) {
                    output = 'L[' + tr + ']\n';
                }
            }

            output += 'M' + memo;
        }
        else if (line[0] == 'D' && line[3] == '/') {
            output = 'D' + line.substr(1).split('/').reverse().join('/');
        }
        else if (line[0] != 'L') {
            output = line;
        }

        return output;
    }).filter(Boolean).join('\n');
};
