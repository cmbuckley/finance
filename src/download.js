var Casper  = require('casper'),
    casper  = Casper.create(),
    utils   = require('utils'),
    cu      = require('clientutils').create(utils.mergeObjects({}, casper.options)),
    fs      = require('fs'),
    hsbc    = require('download/hsbc'),
    options = utils.mergeObjects(JSON.parse(fs.read('config/download.json')), casper.cli.options);

casper.getLink = function (text, selector) {
    return Casper.selectXPath('//' + (selector || 'a') + '[contains(text(), "' + text + '")]');
};

casper.getContents = function (url, method) {
    return cu.decode(casper.base64encode(url, method));
}

casper.start();

hsbc.download(options.credentials, options.from, options.to, function (output) {
    fs.write(options.filename, output.get());
});

casper.run();
