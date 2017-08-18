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
        accounts: {
            selector: function (type) {
                return 'form#vcpost10[action$="' + type + '"]';
            },
            download: {
                action: function () {
                    this.fill('#vcpost5', {}, true);
                },
                waitText: 'download transactions',
            },
            callback: function (from, to) {
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
            }
        },
        accountName: {
            selector: '.NORMALBLA[colspan="4"]',
            modifier: function (name) {
                return name.split(/\s+/).slice(3).join(' ');
            }
        }
    });

exports.download = function (credentials, from, to, output) {
    adapter.setOutput(output);
    adapter.login(credentials);

    // need to wait for login and token migration
    casper.waitForText('my accounts', function () {
        this.info('Listing accounts');
        adapter.getTransactions('sLink', from, to);
    });

    casper.then(adapter.logout.bind(adapter));
};
