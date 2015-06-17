var fs = require('fs');
var jsdom = require('jsdom');
var assert = require('assert');

describe('Utils', function () {
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

    it('should exist', function () {
        assert.ok(this.App.utils);
    });

    describe('#titleCase', function () {
        it('should upper case first character', function () {
            assert.equal(this.App.utils.titleCase('title case'), 'Title Case');
        });

        it('should not alter already upper-case characters', function () {
            assert.equal(this.App.utils.titleCase('Title Case'), 'Title Case');
        });

        it('should not lower case other letters', function () {
            assert.equal(this.App.utils.titleCase('mIxEd cASe'), 'MIxEd CASe')
        });
    });
});
