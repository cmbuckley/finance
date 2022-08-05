var fs = require('fs');
var jsdom = require('jsdom');
var assert = require('assert');

function create(done, context, options) {
    options = options || {};
    options.html = options.html || '';
    options.src = fs.readFileSync(__dirname + '/../../betting/app.js', 'utf-8');
    options.done = function (err, window) {
        context.App = window.App;
        done();
    };

    jsdom.env(options);
}

describe.skip('BetVictor', function () {
    describe('handler', function () {
        before(function (done) {
            create(done, this);
        });

        it('should load', function () {
            assert.ok(new this.App('betvictor'));
        });

        it('should return [] transactions with no html', function (done) {
            var app = new this.App('betvictor');
            app.getTransactions(function (transactions) {
                assert.deepEqual([], transactions);
                done();
            });
        });
    });
});
