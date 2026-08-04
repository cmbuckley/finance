const assert = require('assert');
const sinon = require('sinon');

const util = require('../util');

const GiantAdapter = require('../../src/adapter/giant');

describe('GiantAdapter', () => {
    describe('#getTransactions', () => {
        it('parses transactions', async () => {
            const adapter = new GiantAdapter;

            adapter.lines = [
                'Irrelevant stuff',
                '27/07/2026',
                'Income',
                'ABC W/E 19/07/2026 NAME 1.00 £200.00 £200.00',
                'ABC W/E 12/07/2026 NAME 5.00 £200.00 £1,000.00',
                'ABC W/E 05/07/2026 NAME 5.00 £200.00 £1,000.00',
                'ABC W/E 28/06/2026 NAME 4.00 £200.00 £800.00',
                'Assignment Income £4,000.00',
                'Taxable Billable Expenses',
                'ABC B/EXP 21/06/2026 NAME 1.00 £35.08 £35.08',
                'W/E 24/05/2026 Billable Expenses (Taxable) -1.00 £55.95 -£55.95',
                'Total Taxable Billable Expenses -£20.87',
                'Total Income £3,979.13',
                'Deductions retained (to arrive at taxable pay)',
                'Giant margin - Umbrella Premium £20.50',
                "Employer's pension contribution £0.00",
                "Employer's NIC (15% of gross pay minus allowances) £45.66",
                'Apprenticeship Levy (0.5% of gross pay) £3.27',
                'Employers Pension Contributions £1,000.00',
                'Total deductions £1,724.43',
                'Total Pay £2,345.67',
                'Payslip Units Rate Total',
                'Hours this pay period 150.00',
                'Pay',
                '- Basic Pay £1,881.08',
                '- Conditional Pay £1,686.42',
                'Holiday Pay (hours/day x rate) 20.00 £4.36 £87.20',
                'Taxable gross pay £3,254.70',
                'Employees Tax £1,061.66',
                'Employee NIC £72.59',
                'Total Deductions £1,134.25',
                'Net Pay £2,345.67',
                'Add Billable Expenses (Non-Taxable)',
                'Billable Expenses (Non-Taxable) £55.95',
                'Total Billable Expenses (Non-Taxable) £55.95',
                'Total Net Pay this tax period £2,400.16',
                '',
                '-- 1 of 1 --',
            ];

            const transactions = await adapter.getTransactions();

            assert.equal(transactions[0].raw.date, '27/07/2026');
            assert.equal(transactions[0].getLocalAmount(), 200);
            assert.equal(transactions[0].getMemo(), 'ABC W/E 19/07/2026 NAME (1d)');

            assert.equal(transactions[4].getLocalAmount(), 35.08);
            assert.equal(transactions[4].getCategory(), 'Job Expenses');
            assert.equal(transactions[5].getLocalAmount(), -55.95);
            assert.equal(transactions[5].getCategory(), 'Job Expenses');

            assert.equal(transactions[6].getLocalAmount(), -20.50);
            assert.equal(transactions[6].getMemo(), 'Giant margin - Umbrella Premium');

            assert.equal(transactions[9].getLocalAmount(), -1000);
            assert.equal(transactions[9].getMemo(), 'Employers Pension Contributions');

            assert.equal(transactions[13].getPayee(), 'HMRC');
            assert.equal(transactions[13].getCategory(), 'Taxes:Income Tax');
            assert.equal(transactions[14].getPayee(), 'HMRC');
            assert.equal(transactions[14].getCategory(), 'Taxes:National Insurance');
        });
    });
});
