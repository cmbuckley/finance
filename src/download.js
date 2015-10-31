var Casper  = require('casper'),
    casper  = Casper.create(),
    utils   = require('utils'),
    cu      = require('clientutils').create(utils.mergeObjects({}, casper.options)),
    fs      = require('fs'),
    output  = require('download/output'),
    options = utils.mergeObjects(JSON.parse(fs.read('config/download.json')), casper.cli.options);

casper.getLabelContains = function (text, selector) {
    return Casper.selectXPath('//' + (selector || '*') + '[contains(text(), "' + text + '")]');
};

casper.getContents = function (url, method) {
    return cu.decode(casper.base64encode(url, method));
}

casper.start();

if (options.hsbc) {
    casper.then(function () {
        require('download/hsbc').download(options.hsbc.credentials, options.from, options.to, output);
    });
}

casper.then(function () {
    fs.write(options.filename, output.get());
});

casper.run();
