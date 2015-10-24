var Casper  = require('casper'),
    casper  = Casper.create(),
    utils   = require('utils'),
    cu      = require('clientutils').create(utils.mergeObjects({}, casper.options)),
    fs      = require('fs'),
    details = JSON.parse(fs.read('config/download.json'));

function getLink(text, selector) {
    return Casper.selectXPath('//' + (selector || 'a') + '[contains(text(), "' + text + '")]');
}

function getContents(url, method) {
    return cu.decode(casper.base64encode(url, method));
}

casper.start('http://www.hsbc.co.uk/1/2/personal/pib-home', function () {
    this.echo('Logging in to HSBC');
    this.fill('#logonForm', {userid: details.userid}, true);
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
        memorableAnswer: details.memorableAnswer,
        password:        '',
    };

    // build form values. build password field manually to avoid onsubmit javascript
    this.getElementsAttribute('input[type="password"][name^="pass"]:not([disabled])', 'id').forEach(function (field) {
        var pos = +field.substr(-1);
        values.password += values[field] = details.password.substr(pos + (pos > 6 ? details.password.length - 9 : -1), 1);
    });

    this.fill('form', values, true);
});

casper.then(function () {
    this.echo('Opening Current Account');
    var form = this.getElementAttribute('form[action$="transaction"]', 'id');
    this.fill('#' + form, {}, true);
});

casper.then(function () {
    this.echo('Selecting dates: 2015-08-10 - 2015-08-31');

    // all javascript form submission does here is validate the form
    this.fill('.containerMain form', {
        fromDateDay: '10',
        fromDateMonth: '8',
        fromDateYear: '2015',
        toDateDay: '31',
        toDateMonth: '8',
        toDateYear: '2015'
    }, true);
});

// download transactions (need xpath because of trailing whitespace)
casper.thenClick(getLink('Download transactions'));

casper.then(function () {
    this.echo('Selecting format');
    this.fill('.containerMain form', {
        downloadType: 'M_OFXMainstream'
    }, true);
});

casper.then(function () {
    this.echo('Downloading file');
    var file = getContents(this.getElementAttribute('.containerMain form', 'action'), 'POST');
});

casper.run();
