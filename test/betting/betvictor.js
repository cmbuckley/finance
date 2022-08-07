const fs = require('fs').promises;
const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('assert');

describe('BetVictor', () => {
    before((done) => {
        const file = __dirname + '/../../betting/app.js';
        const { window } = new JSDOM(`<script src="file:///${file}"></script>`, {
            runScripts: 'dangerously',
            resources: 'usable',
            virtualConsole: new VirtualConsole,
        });

        window.document.addEventListener('DOMContentLoaded', () => {
            this.App = window.App;
            done();
        });
    });

    describe('handler', () => {
        it('should load', () => {
            assert.ok(new this.App('betvictor'));
        });

        it('should return [] transactions with no html', (done) => {
            var app = new this.App('betvictor');
            app.getTransactions((transactions) => {
                assert.deepEqual([], transactions);
                done();
            });
        });
    });
});
