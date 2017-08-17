function Adapter(casper, config) {
    this.config = config;
    this.casper = casper;
}

Adapter.prototype.setOutput = function (output) {
    this.output = output;
};

Adapter.prototype.login = function (credentials) {
    var config = this.config,
        casper = this.casper;

    casper.thenOpen(config.url);

    casper.waitForText(config.labels.welcome, function () {
        this.info('Logging in to ' + config.name);
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
        this.clickLabel(config.labels.withoutKey);
    });

    // password form
    casper.then(function () {
        var values = {
            memorableAnswer: credentials.memorableAnswer,
            password:        '',
        };

        this.info('Entering password');

        // build form values. build password field manually to avoid onsubmit javascript
        this.getElementsAttribute(config.password.selector, 'id').forEach(function (field) {
            values.password += values[field] = credentials.password.substr(config.password.iterator(field), 1);
        });

        this.fill('form', values, true);
    });
};

Adapter.prototype.downloadFile = function () {
    var url  = this.casper.getElementAttribute('form[name$="downloadForm"]', 'action'),
        name = this.casper.fetchText(this.config.accountName.selector);

    this.casper.info('  Downloading file');
    this.output.add(this.config.accountName.modifier(name), casper.getContents(url, 'POST'));
};

Adapter.prototype.logout = function () {
    var button = this.casper.getLabelContains(this.config.labels.logout);

    if (this.casper.exists(button)) {
        this.casper.info('Logging out');
        this.casper.click(button);
    }
};

module.exports = Adapter;

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
    var button = this.getLabelContains('Log off');
    if (this.exists(button)) {
        this.info('Logging out');
        this.click(button);
    }
}

// log out on error
casper.on('error', function (msg, trace) {
    this.warning(msg);
    logout();
});

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
    });

    casper.then(logout);
};
