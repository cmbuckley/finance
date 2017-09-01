var Adapter = require('../lib/hsbc'),
    adapter = new Adapter(casper, {
        name: 'HSBC',
        url: 'http://www.hsbc.co.uk/1/2/personal/pib-home',
        labels: {
            welcome: 'Log on to Online Banking',
            withoutKey: 'Without Secure Key',
            logout: 'Log off',
        },
        password: {
            selector: 'input.active',
            iterator: function (field) {
                var pos = +field.substr(-1);
                return pos - (pos > 6 ? 9 : 1);
            }
        },
        accounts: {
            selector: function (type) {
                return 'form[action$="' + type + '"]';
            },
            callback: function (from, to) {
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
            }
        },
        accountName: {
            selector: '.hsbcAccountType',
            modifier: function (name) {
                return (/^[\d\s]+$/.test(name) ? 'Credit Card' : name.trim());
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
                    this.waitForUrl('downloadtransaction=', adapter.downloadFile.bind(adapter));
                }
            });
        }
        else {
            casper.then(function () {
                this.fill('.containerMain form', {
                    downloadType: 'M_QIF'
                }, true);
            });

            casper.then(adapter.downloadFile.bind(adapter));
        }
    }
}

exports.download = function (credentials, from, to, output) {
    adapter.setOutput(output);
    adapter.login(credentials);

    // need to wait for login and token migration
    casper.waitForText('My accounts', function () {
        // click to expand and include the mortgage
        this.clickLabelContains('Show All');
    });

    casper.then(function () {
        this.info('Listing regular accounts');
        adapter.getTransactions('recent-transaction', from, to);
    });

    casper.then(function () {
        this.info('Listing credit card accounts');
        adapter.getTransactions('credit-card-transactions', from, to);
    });

    casper.then(adapter.logout.bind(adapter));
};
