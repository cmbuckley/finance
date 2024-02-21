const fs = require('fs').promises;
const { JSDOM, VirtualConsole } = require('jsdom');
const sinon = require('sinon');
const assert = require('assert');

describe('Payslips', () => {
    before(done => {
        let vc = new VirtualConsole;
        vc.on('jsdomError', e => console.error('error:', e.detail || e));

        JSDOM.fromFile(__dirname + '/test.html', {
            runScripts: 'dangerously',
            resources: 'usable',
            virtualConsole: vc,
        }).then(dom => {
            this.dom = dom;
            dom.window.document.addEventListener('DOMContentLoaded', () => done());
        });
    });

    it('should overwrite XHR', () => {
        assert.ok(this.dom.window.XMLHttpRequest.tampered);
    });

    describe('loaded', () => {
        beforeEach(done => {
            const xhr = new this.dom.window.XMLHttpRequest;
            xhr.open('GET', 'test.html?fake=directory/12345/payslips/abcde');
            xhr.send();
            setTimeout(done, 250); // @todo improve
        });

        it('should insert a download button', () => {
            const btn = this.dom.window.document.querySelector('.buttons .btn');
            assert.equal(btn.textContent, 'Download QIF');
        });

        it('should download a QIF', async () => {
            // stub out the a.click() event to avoid navigation
            sinon.stub(this.dom.window.HTMLAnchorElement.prototype, 'click');

            const btn = this.dom.window.document.querySelector('.buttons .btn');
            btn.dispatchEvent(new this.dom.window.Event('click')); // btn.click() is stubbed

            const download = this.dom.window.document.querySelector('a[download]');
            assert.ok(download);
            assert.equal(download.download, 'payslips-2022-06-24.qif');

            const [type, b64] = download.href.split(',');
            assert.equal(type, 'data:text/qif;base64');

            const expected = await fs.readFile(__dirname + '/expected.qif', 'utf8');
            assert.equal(Buffer.from(b64, 'base64').toString('ascii'), expected);
        })
    });
});
