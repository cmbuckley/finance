const sinon = require('sinon');
const assert = require('assert');

const fs = require('fs').promises;
const origReadFile = fs.readFile;

const util = require('../util');
const Fixture = require('../../src/adapter/pokerstars');

function csv(rows, filename) {
    sinon.stub(fs, 'readFile').callsFake(origReadFile).withArgs(filename || 'fixsource').resolves([
        ["Playing History Audit 'username' from 2020/01/04 12:00 AM to 2022/02/19 11:59 PM"],
        ['Transaction Details', 'Individual Transaction Amounts', 'Running Balance'],
        [
            'Date/Time',
            'Action',
            'Table Name / Player / Tournament #',
            'Game',
            'Account Currency',
            'Amount',
            'Accrued StarsCoin',
            'T Money',
            'W Money',
            'Balance',
            'Total Accrued StarsCoin After this Transaction',
            'T Money',
            'W Money',
        ]
    ].concat(rows).map(r => r.join(',')).join('\r\n'));
}

describe('PokerStars adapter', () => {
    afterEach(sinon.restore);

    it('should parse the CSV', async () => {
        csv([[
            '2020/12/16 6:36 AM',
            'Tournament Registration',
            '3074307335Time for a Raise?',
            '" NL Hold\'em Buy-In: 10.00/1.00"',
            'GBP',
            '"-11.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
            '"64.53"',
            '"225.00"',
            '"0.00"',
            '"0.00"',
        ]]);

        const fixture = new Fixture('', {
            source: 'fixsource',
            name: 'PokerStars'
        }, util.logger());

        await fixture.login();
        const transactions = await fixture.getTransactions('2020-12-01', '2020-12-31');
        assert.equal(transactions.length, 1);
        assert.equal(transactions[0].getLocalAmount(), '-11.00');
        assert.equal(transactions[0].isDebit(), true);
        assert.equal(transactions[0].getMemo(), 'Tournament Registration - NLH - 3074307335 - Time for a Raise?');
        assert.equal(transactions[0].getCategory(), 'Leisure:Betting');

        // date filtering
        const noTransactions = await fixture.getTransactions('2021-01-01', '2021-01-31');
        assert.equal(noTransactions.length, 0);
    });

    it('should handle inter account transfers', async () => {
        csv([[
            '2024/01/26 2:32 PM',
            'Inter Account Transfer',
            '3249538765',
            '',
            'USD',
            '"-20.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
        ], [
            '2024/01/26 2:32 PM',
            'Inter Account Transfer',
            '3249538766',
            '',
            'GBP',
            '"15.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
            '"15.00"',
            '"0.00"',
            '"0.00"',
            '"0.00"',
        ]]);

        const fixture = new Fixture('', {
            source: 'fixsource',
            name: 'PokerStars'
        }, util.logger());

        await fixture.login();
        const transactions = await fixture.getTransactions('2024-01-01', '2024-01-31');

        assert.equal(transactions.length, 2);
        assert.equal(transactions[0].getAccount(), 'PokerStars (USD)');
        assert.equal(transactions[0].getCurrency(), 'USD');
        assert.equal(transactions[0].getTransfer(), 'PokerStars (GBP)');
        assert.equal(transactions[0].getLocalAmount(), '-20.00');

        assert.equal(transactions[1].getAccount(), 'PokerStars (GBP)');
        assert.equal(transactions[1].getCurrency(), 'USD');
        assert.equal(transactions[1].getLocalAmount(), '20.00');
        assert.equal(transactions[1].getExchangeRate(), '0.75');
    });
});
