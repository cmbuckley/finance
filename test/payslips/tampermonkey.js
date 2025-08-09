const fs = require('fs').promises;
const { JSDOM, VirtualConsole } = require('jsdom');
const sinon = require('sinon');
const assert = require('assert');
const debug = require('debug')('test:logs');

describe('Payslips', () => {
    before(done => {
        let vc = new VirtualConsole;
        vc.on('jsdomError', e => console.error('error:', e.detail || e));
        vc.on('log', debug); // to output: DEBUG=test:logs npm test

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
        function clickDownload(ctx) {
            // stub out the a.click() event to avoid navigation
            sinon.stub(ctx.dom.window.HTMLAnchorElement.prototype, 'click');

            const btn = ctx.dom.window.document.querySelector('.buttons .btn');
            btn.dispatchEvent(new ctx.dom.window.Event('click')); // btn.click() is stubbed
        }

        beforeEach(done => {
            // grab date for restore later
            this.dateElement = this.dom.window.document.querySelector('.date tbody td:nth-of-type(2)');
            this.defaultDate = this.dateElement.innerHTML;

            const xhr = new this.dom.window.XMLHttpRequest;
            xhr.open('GET', 'test.html?fake=directory/12345/payslips/abcde');
            xhr.send();
            setTimeout(done, 250); // @todo improve
        });

        afterEach(() => {
            this.dateElement.innerHTML = this.defaultDate;
            this.dom.window.document.querySelectorAll('a[download]').forEach(a => a.remove());
            sinon.restore();
        });

        it('should insert a download button', () => {
            const btn = this.dom.window.document.querySelector('.buttons .btn');
            assert.equal(btn.textContent, 'Download QIF');
        });

        [
            ['31/01/2025', '2025-01-28'],
            ['28/02/2025', '2025-02-28'],
            ['31/03/2025', '2025-03-28'],
            ['30/06/2025', '2025-06-27'], // 28th is a Sat
            ['30/09/2025', '2025-09-26'], // 28th is a Sun
        ].forEach(([date, payday]) => {
            it(`should create file with correct payday (${payday})`, async () => {

                this.dom.window.document.querySelector('.date tbody td:nth-of-type(2)').innerHTML = date;
                clickDownload(this);

                const download = this.dom.window.document.querySelector('a[download]');
                assert.ok(download);
                assert.equal(download.download, 'payslips-' + payday + '.qif');
            });
        });

        it('should download a QIF', async () => {
            clickDownload(this);

            const download = this.dom.window.document.querySelector('a[download]');
            assert.ok(download);
            assert.equal(download.download, 'payslips-2022-06-28.qif');

            const [type, b64] = download.href.split(',');
            assert.equal(type, 'data:text/qif;base64');

            const expected = await fs.readFile(__dirname + '/expected.qif', 'utf8');
            assert.equal(Buffer.from(b64, 'base64').toString('ascii'), expected);
        })
    });
});
