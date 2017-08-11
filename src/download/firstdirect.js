function login(credentials) {
    casper.thenOpen('https://www.firstdirect.com/1/2/idv.Logoff?nextPage=fsdtBalances');

    casper.waitForText('Welcome to Internet Banking', function () {
        this.info('Logging in to first direct');
        this.fill('form', {userid: credentials.userid}, true);
    });

    // occasional interstitial page
    casper.then(function () {
        if (this.exists('#tempForm')) {
            this.info('Submitting login form');
            this.fill('#tempForm', {}, true);
        }
    });

    casper.then(function () {
        this.info('Proceeding without Secure Key');
        this.clickLabel('Log on without your Secure Key');
    });

    // password form
    casper.then(function () {
        var values = {
            memorableAnswer: credentials.memorableAnswer,
            password:        '',
        };

        this.info('Entering password');

        // build form values. build password field manually to avoid onsubmit javascript
        this.getElementsAttribute('input[type="password"][name^="keyrcc_password"]', 'id').forEach(function (field) {
            var pos = casper.fetchText('label[for="' + field + '"]').match(/\d+|[a-z]+/i);

            if (isNaN(+pos)) {
                pos = {penultimate: -1, Last: 0}[pos];
            }

            values.password += values[field] = credentials.password.substr(pos - 1, 1);
        });

        this.fill('form', values, true);
    });
}

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

function downloadFile() {
    var url  = this.getElementAttribute('.containerMain form[name$="downloadForm"]', 'action'),
        name = this.getHTML('.hsbcAccountType').trim();

    if (/\d+/.test(name)) {
        name = 'Credit Card';
    }

    this.info('  Downloading file');
    output.add(name, casper.getContents(url, 'POST'));
}

function listTransactions(type, from, to, output) {
    var selector = 'form[action$="' + type + '"]';

    casper.getElementsInfo(selector).forEach(function (account, accountIndex, accounts) {
        casper.then(function () {
            // re-evaluate element info for this page - form IDs change each time
            account = this.getElementsInfo(selector)[accountIndex];
            this.info('Opening "' + account.html.match(/<a[^>]*>([^<]*)<\/a>/)[1] + '" account (' + (accountIndex + 1) + '/' + accounts.length + ')');
            this.fill('#' + account.attributes.id, {}, true);
        });

        // wait for the transactions page
        casper.waitForUrl(type, function () {
            var fromDate = new Date(from),
                toDate   = (to ? new Date(to) : new Date()),
                formSelector = '.containerMain .extContentHighlightPib form';

            if (this.exists(formSelector)) {
                this.info('  Selecting dates: ' + from + ' - ' + (to || 'today'));

                // all javascript form submission does here is validate the form
                this.fill(formSelector, {
                    fromDateDay:   fromDate.getDate(),
                    fromDateMonth: fromDate.getMonth() + 1,
                    fromDateYear:  fromDate.getFullYear(),
                    toDateDay:     toDate.getDate(),
                    toDateMonth:   toDate.getMonth() + 1,
                    toDateYear:    toDate.getFullYear()
                }, true);

                this.waitForUrl('OnSelectDateThsTransactionsCommand', function () {
                    selectFileOptions();
                });
            }
            else {
                this.info('  Selecting recent transactions');
                selectFileOptions(true, from);
            }
        });

        // back to the accounts page for the next iteration
        casper.then(function () {
            this.clickLabel('My accounts');
        });
    });
}

function logout() {
    this.info('Logging out');
    this.clickLabel('log off');
}

// log out on error
casper.on('error', function (msg, trace) {
    this.warning(msg);
    logout();
});

exports.download = function (credentials, from, to, output) {
    login(credentials);

    // need to wait for login and token migration
    casper.waitForText('my accounts', function () {
        this.echo('Done!');
    });

    /*casper.then(function () {
        this.info('Listing regular accounts');
        listTransactions('recent-transaction', from, to, output);
    });

    casper.then(function () {
        this.info('Listing credit card accounts');
        listTransactions('credit-card-transactions', from, to, output);
    });*/

    casper.then(logout);
};
