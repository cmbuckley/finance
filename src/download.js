var Casper  = require('casper'),
    casper  = Casper.create({
        waitTimeout: 10000,
    }),
    utils   = require('utils'),
    cu      = require('clientutils').create(utils.mergeObjects({}, casper.options)),
    fs      = require('fs'),
    output  = require('lib/output'),
    options = utils.mergeObjects(JSON.parse(fs.read('config/download.json')), casper.cli.options);

if (options.verbose) {
    casper.options.logLevel = 'debug';
    casper.options.verbose = true;
}

casper.getLabelContains = function (text, selector) {
    return Casper.selectXPath('//' + (selector || '*') + '[text()[contains(., "' + text + '")]]');
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

['error', 'timeout', 'waitFor.timeout'].forEach(function (event) {
    casper.on(event, function (msg) {
        if (typeof msg == 'string') {
            this.warning(msg);
        }

        fs.write('casper-debug.html', this.getHTML());
    });
});

casper.start();

if (options.test) {
    casper.info('Loading test file ' + options.test);
    output.load(fs.read(options.test));
}
else {
    if (options.which) {
        options.which = options.which.split(',');
    }
    else {
        // get all download adapters
        options.which = fs.list('src/download').map(function (file) {
            return (/\.js$/.test(file) ? file.replace('.js', '') : false);
        }).filter(Boolean);
    }

    options.which.forEach(function (type) {
        if (options[type]) {
            casper.then(function () {
                require('download/' + type).download(options[type].credentials, options.from, options.to, output);
            });
        }
    });
}

casper.then(function () {
    this.info('Writing output to ' + options.filename);
    fs.write(options.filename, output.get());
});

casper.run();
