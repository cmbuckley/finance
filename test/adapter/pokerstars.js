const sinon = require('sinon');
const assert = require('assert');

const fs = require('fs').promises;
const origReadFile = fs.readFile;

const Fixture = require('../../src/adapter/pokerstars');

describe('PokerStars adapter', () => {
    it('should parse the CSV', async () => {
        sinon.stub(fs, 'readFile').callsFake(origReadFile).withArgs('fixsource').resolves([
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
            ], [
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
            ]
        ].map(r => r.join(',')).join('\r\n'));

        const fixture = new Fixture('', {
            source: 'fixsource',
            name: 'PokerStars'
        }, {
            silly: () => {},
        });

        await fixture.login();
        const transactions = await fixture.getTransactions('2020-12-01', '2020-12-31');
        assert.equal(transactions.length, 1);
        assert.equal(transactions[0].getLocalAmount(), '-11.00');
    });
});
