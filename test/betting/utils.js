const fs = require('fs').promises;
const { JSDOM } = require('jsdom');
const assert = require('assert');

describe('Utils', () => {
    before((done) => {
        const file = __dirname + '/../../betting/app.js';
        const { window } = new JSDOM(`<script src="file:///${file}"></script>`, {
            runScripts: 'dangerously',
            resources: 'usable',
        });

        window.document.addEventListener('DOMContentLoaded', () => {
            this.App = window.App;
            done();
        });
    });

    it('exists', () => {
        assert.ok(this.App.utils);
    });

    describe('#titleCase', () => {
        it('upper cases first character', () => {
            assert.equal(this.App.utils.titleCase('title case'), 'Title Case');
        });

        it('preserved already upper-case characters', () => {
            assert.equal(this.App.utils.titleCase('Title Case'), 'Title Case');
        });

        it('preserves case of other letters', () => {
            assert.equal(this.App.utils.titleCase('mIxEd cASe'), 'MIxEd CASe')
        });
    });
});
