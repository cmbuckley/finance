function Adapter(casper, config) {
    this.config = config;
    this.casper = casper;

    // log out on error
    this.casper.on('error', function (msg, trace) {
        this.casper.warning(msg);
        this.logout();
    }.bind(this));
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

Adapter.prototype.getTransactions = function (type, from, to) {
    var config = this.config,
        casper = this.casper,
        selector = config.accounts.selector(type);

    casper.getElementsInfo(selector).forEach(function (account, accountIndex, accounts) {
        casper.then(function () {
            // re-evaluate element info for this page - form IDs change each time
            account = this.getElementsInfo(selector)[accountIndex];
            this.info('Opening "' + account.html.match(/<a[^>]*>([^<]*)<\/a>/)[1] + '" account (' + (accountIndex + 1) + '/' + accounts.length + ')');
            this.fill('#' + account.attributes.id, {}, true);
        });

        casper.waitForUrl(type, function () {
            var callback = function () {
                config.accounts.callback.call(casper, from, to);
            };

            if (config.accounts.download) {
                config.accounts.download.action.call(casper);
                casper.waitForText(config.accounts.download.waitText, callback);
            }
            else {
                callback();
            }
        });

        // back to the accounts page for the next iteration
        casper.then(function () {
            this.clickLabelContains('My accounts');
        });
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
