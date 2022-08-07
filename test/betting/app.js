const fs = require('fs').promises;
const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('assert');
const provider = require('./examples.json');

describe('Betting app', () => {
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

    describe('interface', () => {
        it('should be exported', () => {
            assert.ok(this.App);
        });

        it('should complain for invalid handler', () => {
            assert.throws(() => {
                new this.App('missing');
            }, /Invalid handler/);
        });
    });

    describe('#getTransaction', () => {
        before(() => {
            this.fixture = new this.App('bet365');
        });

        provider.forEach((example) => {
            it('should handle ' + example.name, () => {
                assert.deepEqual(example.transaction, this.fixture.getTransaction(example.data));
            });
        });
    });

    describe('#getDescription', () => {
        before(() => {
            this.fixture = new this.App('bet365');
        });
    });
});
