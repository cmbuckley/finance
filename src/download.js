var Casper  = require('casper'),
    casper  = Casper.create({
        waitTimeout: 10000,
    }),
    utils   = require('utils'),
    cu      = require('clientutils').create(utils.mergeObjects({}, casper.options)),
    fs      = require('fs'),
    output  = require('download/output'),
    options = utils.mergeObjects(JSON.parse(fs.read('config/download.json')), casper.cli.options);

casper.getLabelContains = function (text, selector) {
    return Casper.selectXPath('//' + (selector || '*') + '[contains(text(), "' + text + '")]');
};

casper.clickLabelContains = function (text, selector) {
    return this.click(this.getLabelContains(text, selector));
};

casper.getContents = function (url, method) {
    return cu.decode(casper.base64encode(url, method));
};

['info', 'warning'].forEach(function (level) {
    casper[level] = function (message, pad) {
        casper.echo(message, level.toUpperCase(), pad);
    };
});

casper.on('error', function () {
    fs.write('casper-debug.html', this.getHTML());
});

casper.start();

if (options.test) {
    casper.info('Loading test file ' + options.test);
    output.load(fs.read(options.test));
}
else {
    if (options.hsbc) {
        casper.then(function () {
            require('download/hsbc').download(options.hsbc.credentials, options.from, options.to, output);
        });
    }
}

casper.then(function () {
    this.info('Writing output to ' + options.filename);
    fs.write(options.filename, output.get());
});

casper.run();
