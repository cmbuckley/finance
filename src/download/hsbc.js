function login(credentials) {
    casper.thenOpen('http://www.hsbc.co.uk/1/2/personal/pib-home', function () {
        this.echo('Logging in to HSBC');
        this.fill('#logonForm', {userid: credentials.userid}, true);
    });

    // occasional interstitial page
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

    // password form
    casper.then(function () {
        var values = {
            memorableAnswer: credentials.memorableAnswer,
            password:        '',
        };

        this.echo('Entering password');

        // build form values. build password field manually to avoid onsubmit javascript
        this.getElementsAttribute('input[type="password"][name^="pass"]:not([disabled])', 'id').forEach(function (field) {
            var pos = +field.substr(-1);
            values.password += values[field] = credentials.password.substr(pos + (pos > 6 ? credentials.password.length - 9 : -1), 1);
        });

        this.fill('form', values, true);
    });
}

function download(from, to, output) {
    return function (account, accountIndex, accounts) {
        casper.then(function () {
            // re-evaluate element info for this page - form IDs change each time
            account = this.getElementsInfo('form[action$="recent-transaction"]')[accountIndex];
            this.echo('Opening "' + account.html.match(/<a[^>]*>([^<]*)<\/a>/)[1] + '" account (' + (accountIndex + 1) + '/' + accounts.length + ')');
            this.fill('#' + account.attributes.id, {}, true);
        });

        casper.then(function () {
            var fromDate = new Date(from),
                toDate   = (to ? new Date(to) : new Date());

            this.echo('  Selecting dates: ' + from + ' - ' + (to || 'today'));

            // all javascript form submission does here is validate the form
            this.fill('.containerMain form', {
                fromDateDay:   fromDate.getDate(),
                fromDateMonth: fromDate.getMonth() + 1,
                fromDateYear:  fromDate.getFullYear(),
                toDateDay:     toDate.getDate(),
                toDateMonth:   toDate.getMonth() + 1,
                toDateYear:    toDate.getFullYear()
            }, true);
        });

        casper.waitForUrl(/OnSelectDateThsTransactionsCommand/, function () {
            var download = casper.getLabelContains('Download transactions');

            // check for link (missing if no transactions)
            if (this.exists(download)) {
                this.click(download);

                this.then(function () {
                    this.echo('  Selecting QIF format');
                    this.fill('.containerMain form', {
                        downloadType: 'M_QIF'
                    }, true);
                });

                this.then(function () {
                    this.echo('  Downloading file');
                    var url = this.getElementAttribute('.containerMain form', 'action');
                    output.add(this.getHTML('.hsbcAccountType'), casper.getContents(url, 'POST'));
                });
            }
            else {
                this.echo('  No transactions in date range');
            }
        });

        casper.then(function () {
            this.clickLabel('My accounts');
        });
    };
}

exports.download = function (credentials, from, to, output) {
    login(credentials);

    // need to wait for login and token migration
    casper.waitForUrl(/online-banking/, function () {
        // click to expand and include the mortgage
        this.echo('Listing all accounts');
        this.clickLabel('Loans and Mortgages');
    });

    casper.then(function () {
        this.getElementsInfo('form[action$="recent-transaction"]').forEach(download(from, to, output));
    });

    casper.then(function () {
        this.echo('Logging out');
        this.clickLabel('Log off');
    });
};
