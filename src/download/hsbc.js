function login(credentials) {
    casper.thenOpen('http://www.hsbc.co.uk/1/2/personal/pib-home', function () {
        this.info('Logging in to HSBC');
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
        this.clickLabel('Without Secure Key');
    });

    // password form
    casper.then(function () {
        var values = {
            memorableAnswer: credentials.memorableAnswer,
            password:        '',
        };

        this.info('Entering password');

        // build form values. build password field manually to avoid onsubmit javascript
        this.getElementsAttribute('input[type="password"][name^="pass"]:not([disabled])', 'id').forEach(function (field) {
            var pos = +field.substr(-1);
            values.password += values[field] = credentials.password.substr(pos + (pos > 6 ? credentials.password.length - 9 : -1), 1);
        });

        this.fill('form', values, true);
    });
}

function download() {
    if (casper.exists('.hsbcTextHighlightError') && casper.getHTML('.hsbcTextHighlightError').indexOf('(833)')) {
        casper.warning('Cannot display all transactions for range', 2);
    }

    var label = casper.getLabelContains('Download transactions');

    // check for link (missing if no transactions)
    if (casper.exists(label)) {
        casper.click(label);

        // todo check for recent transactions dropdown
        casper.then(function () {
            var formValues = {downloadType: 'M_QIF'};
            this.info('  Selecting QIF format');

            // credit card has different form options
            if (this.exists('#transactionPeriodSelected')) {
                formValues = {
                    transactionPeriodSelected: 'CURRENTPERIOD',
                    formats: 'QIF1'
                };
            }

            this.fill('.containerMain form', formValues, true);
        });

        casper.then(function () {
            var url  = this.getElementAttribute('.containerMain form[name$="downloadForm"]', 'action'),
                name = this.getHTML('.hsbcAccountType').trim();

            if (/\d+/.test(name)) {
                name = 'Credit Card';
            }

            this.info('  Downloading file');
            this.info(url);
            output.add(name, casper.getContents(url, 'POST'));
        });
    }
    else {
        casper.info('  No transactions in range');
    }
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

            if (/no transactions/.test(this.fetchText('#content .hsbcMainContent'))) {
                this.info('  No transactions found');
            }
            else {
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

                    this.waitForUrl('OnSelectDateThsTransactionsCommand', download);
                }
                else {
                    this.info('  Selecting recent transactions');
                    download();
                }
            }
        });


        // back to the accounts page for the next iteration
        casper.then(function () {
            this.clickLabel('My accounts');
        });
    });
}

function logout() {
    var button = this.getLabelContains('Log off');
    if (this.exists(button)) {
        this.info('Logging out');
        this.click(button);
    }
}

// log out on error
casper.on('error', logout);

exports.download = function (credentials, from, to, output) {
    login(credentials);

    // need to wait for login and token migration
    casper.waitForUrl(/pib-home/, function () {
        // click to expand and include the mortgage
        this.clickLabelContains('Show All');
    });

    casper.then(function () {
        this.info('Listing regular accounts');
        listTransactions('recent-transaction', from, to, output);
    });

    casper.then(function () {
        this.info('Listing credit card accounts');
        listTransactions('credit-card-transactions', from, to, output);
    })

    casper.then(logout);
};
