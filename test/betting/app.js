var fs = require('fs');
var jsdom = require('jsdom');
var assert = require('assert');
var provider = require('./examples.json');

describe.skip('Betting app', function () {
    before(function (done) {
        var context = this;

        jsdom.env({
            html: '',
            src: fs.readFileSync(__dirname + '/../../betting/app.js', 'utf-8'),
            done: function (err, window) {
                context.App = window.App;
                done();
            }
        });
    });

    describe('interface', function () {
        it('should be exported', function () {
            assert.ok(this.App);
        });

        it('should complain for invalid handler', function () {
            assert.throws(function () {
                new this.App('missing');
            }.bind(this), /Invalid handler/);
        });
    });

    describe('#getTransaction', function () {
        before(function () {
            this.fixture = new this.App('bet365');
        });

        provider.forEach(function (example) {
            it('should handle ' + example.name, function () {
                assert.deepEqual(example.transaction, this.fixture.getTransaction(example.data));
            });
        });
    });

    describe('#getDescription', function () {
        before(function () {
            this.fixture = new this.App('bet365');
        });
    });
});
