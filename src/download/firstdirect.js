var Adapter = require('../lib/hsbc'),
    adapter = new Adapter(casper, {
        name: 'first direct',
        url: 'https://www.firstdirect.com/1/2/idv.Logoff?nextPage=fsdtBalances',
        labels: {
            welcome: 'Welcome to Internet Banking',
            withoutKey: 'Log on without your Secure Key',
            logout: 'log off',
        },
        password: {
            selector: 'input[name^="keyrcc_password"]',
            iterator: function (field) {
                var pos = casper.fetchText('label[for="' + field + '"]').match(/\d+|[a-z]+/i);

                return (isNaN(+pos) ? {
                    penultimate: -2,
                    Last: -1
                }[pos] : pos - 1);
            }
        },
        accountName: {
            selector: '.NORMALBLA[colspan="4"]',
            modifier: function (name) {
                return name.split(/\s+/).slice(3).join(' ');
            }
        }
    });

function selectFileOptions(creditCard, from) {
    casper.info('  Selecting file options');

    if (casper.exists('.hsbcTextHighlightError')) {
        var errors = {
                '823': 'No transactions in range',
                '833': 'Cannot display all transactions in range',
                'ES0': 'No recent transactions, falling back to previous statement'
            },
            rawError = casper.fetchText('.hsbcTextHighlightError'),
            errorText, errorCode;

        Object.keys(errors).some(function (code) {
            if (~rawError.indexOf('(' + code + ')')) {
                errorCode = code;
                errorText = errors[code];
                return true;
            }
        });

        casper.warning('  ' + (errorText || rawError));
    }

    var label = casper.getLabelContains('Download transactions');

    // check for link (missing if no transactions)
    if (casper.exists(label)) {
        casper.click(label);

        if (creditCard) {
            casper.then(function () {
                var previousPeriodSelector = '#transactionPeriodSelected option:nth-child(3)',
                    selectedPeriod = 'CURRENTPERIOD';

                if (errorCode === 'ES0') {
                    // no recent transactions - select previous statement - if date is relevant
                    selectedPeriod = this.getElementAttribute(previousPeriodSelector, 'value');

                    if (selectedPeriod < from) {
                        this.warning('  No transactions in range');
                        selectedPeriod = false;
                    }
                    else {
                        this.info('  Selecting ' + this.fetchText(previousPeriodSelector).trim() + ' period');
                    }
                }

                if (selectedPeriod) {
                    // fill the form (submit with js affter)
                    this.fill('.containerMain form', {
                        es_iid:                    this.getElementAttribute('input[name="es_iid"]', 'value'),
                        transactionPeriodSelected: selectedPeriod,
                        formats:                   'QIF1'
                    });

                    this.clickLabel('Download transactions');
                    this.waitForUrl('downloadtransaction=', downloadFile);
                }
            });
        }
        else {
            casper.then(function () {
                this.fill('.containerMain form', {
                    downloadType: 'M_QIF'
                }, true);
            });

            casper.then(downloadFile);
        }
    }
}

function listTransactions(from, to) {
    var type = 'sLink',
        selector = 'form#vcpost10[action$="' + type + '"]';

    casper.getElementsInfo(selector).forEach(function (account, accountIndex, accounts) {
        casper.then(function () {
            // re-evaluate element info for this page - form IDs change each time
            account = this.getElementsInfo(selector)[accountIndex];
            this.info('Opening "' + account.html.match(/<a[^>]*>([^<]*)<\/a>/)[1] + '" account (' + (accountIndex + 1) + '/' + accounts.length + ')');
            this.fill('#' + account.attributes.id, {}, true);
        });

        // click the download link
        casper.waitForUrl(type, function () {
            this.fill('#vcpost5', {}, true);
        });

        casper.waitForText('download transactions', function () {
            var fromDate = new Date(from),
                toDate   = (to ? new Date(to) : new Date());

            // can't download transactions from today
            if (!to) { toDate.setDate(toDate.getDate() - 1); }
            this.info('  Selecting dates: ' + from + ' - ' + (to || 'yesterday'));

            this.fill('form', {
                DownloadFromDate: fromDate.toISOString().substr(0, 10).split('-').reverse().join('/'),
                DownloadToDate:   toDate.toISOString().substr(0, 10).split('-').reverse().join('/'),
                DownloadFormat:   'Quicken 98 [m/d/y]',
            });

            this.clickLabel('download');
            this.waitForSelector('form[name$="downloadForm"]', adapter.downloadFile.bind(adapter));
        });

        // back to the accounts page for the next iteration
        /*casper.then(function () {
            this.clickLabel('My accounts');
        });*/
    });
}

// log out on error
casper.on('error', function (msg, trace) {
    this.warning(msg);
    adapter.logout();
});

exports.download = function (credentials, from, to, output) {
    adapter.setOutput(output);
    adapter.login(credentials);

    // need to wait for login and token migration
    casper.waitForText('my accounts', function () {
        this.info('Listing accounts');
        listTransactions(from, to);
    });

    casper.then(adapter.logout.bind(adapter));
};
