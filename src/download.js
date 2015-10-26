var Casper  = require('casper'),
    casper  = Casper.create(),
    utils   = require('utils'),
    cu      = require('clientutils').create(utils.mergeObjects({}, casper.options)),
    fs      = require('fs'),
    options = utils.mergeObjects(JSON.parse(fs.read('config/download.json')), casper.cli.options),
    accounts;

accounts = {
    'Cash':            /^CASH/,
    'Credit Card':     'HSBC CREDIT CARD',
    'Current Account': /^404401 [0-9]{4}5471/,
    'HSBC ISA':        /^404401 [0-9]{4}3752|BUCKLEY C   \*LYA/,
    'Mortgage':        /MTG 400188[0-9]{4}9172/,
    'PayPal':          'PAYPAL',
    'Payslips':        'SKY UK LIMITED'
};

if (options.test) {
    save(options.filename, fs.read(options.test));
    casper.exit();
}

function save(filename, contents) {
    fs.write(filename, contents.split('\n').map(function (line) {
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
    }).filter(Boolean).join('\n'));
}

function getLink(text, selector) {
    return Casper.selectXPath('//' + (selector || 'a') + '[contains(text(), "' + text + '")]');
}

function getContents(url, method) {
    return cu.decode(casper.base64encode(url, method));
}

casper.start('http://www.hsbc.co.uk/1/2/personal/pib-home', function () {
    this.echo('Logging in to HSBC');
    this.fill('#logonForm', {userid: options.credentials.userid}, true);
});

casper.then(function () {
    if (this.exists('#tempForm')) {
        this.echo('Submitting login form');
        this.fill('#tempForm', {}, true);
    }
});

casper.then(function () {
    this.echo('Proceeding without Secure Key');
    this.clickLabel('Without Secure Key');
});

casper.then(function () {
    var values = {
        memorableAnswer: options.credentials.memorableAnswer,
        password:        '',
    };

    // build form values. build password field manually to avoid onsubmit javascript
    this.getElementsAttribute('input[type="password"][name^="pass"]:not([disabled])', 'id').forEach(function (field) {
        var pos = +field.substr(-1);
        values.password += values[field] = options.credentials.password.substr(pos + (pos > 6 ? options.credentials.password.length - 9 : -1), 1);
    });

    this.fill('form', values, true);
});

casper.then(function () {
    this.echo('Opening Current Account');
    var form = this.getElementAttribute('form[action$="transaction"]', 'id');
    this.fill('#' + form, {}, true);
});

casper.then(function () {
    var from = new Date(options.from),
        to   = (options.to ? new Date(options.to) : new Date());

    this.echo('Selecting dates: ' + options.from + ' - ' + (options.to || 'today'));

    // all javascript form submission does here is validate the form
    this.fill('.containerMain form', {
        fromDateDay:   from.getDate(),
        fromDateMonth: from.getMonth() + 1,
        fromDateYear:  from.getFullYear(),
        toDateDay:     to.getDate(),
        toDateMonth:   to.getMonth() + 1,
        toDateYear:    to.getFullYear()
    }, true);
});

// download transactions (need xpath because of trailing whitespace)
casper.thenClick(getLink('Download transactions'));

casper.then(function () {
    this.echo('Selecting QIF format');
    this.fill('.containerMain form', {
        downloadType: 'M_QIF'
    }, true);
});

casper.then(function () {
    this.echo('Downloading file');
    save(options.filename, getContents(this.getElementAttribute('.containerMain form', 'action'), 'POST'));
});

casper.run();
