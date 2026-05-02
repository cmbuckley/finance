const { readFile } = require('node:fs/promises');
const { PDFParse } = require('pdf-parse');

const Adapter = require('../adapter'),
    Transaction = require('../transaction/giant');

let transactions,
    payee = 'DWP',
    account = 'Payslips';

class GiantAdapter extends Adapter {
    #lines = [];

    async login(options) {
        const file = await readFile(this.config.source);
        const parser = new PDFParse({data: file});
        const result = await parser.getText();
        this.#lines = result.text.split('\n');
    }

    async getTransactions(from, to) {
        let transactions = [],
            mode = '',
            date = '',
            category = 'Gross Pay';

        this.#lines.some(line => {
            if (!date && line.match(/\d{2}\/\d{2}\/\d{4}/)) {
                date = line;
                return;
            }

            switch (line) {
                case 'Income':
                    mode = 'income';
                    category = 'Salary:Gross Pay';
                    break;

                case 'Deductions retained (to arrive at taxable pay)':
                    mode = 'deductions';
                    payee = 'Giant Umbrella Company';
                    category = 'Salary:Umbrella Costs';
                    break;

                default:
                    const poundSplit = line.split(/£/g).map(s => s.trim()),
                        amount = poundSplit[poundSplit.length - 1];

                    let memo = poundSplit[0];

                    switch (memo) {
                        // exit loop at the end of the table
                        case 'Total Net Pay this tax period': return true;

                        // ignore for a bit
                        case 'Total deductions':
                            mode = '';
                            return;

                        // and start again for employee deductions
                        case 'Taxable gross pay':
                            mode = 'deductions';
                            payee = 'HMRC';
                            return;

                        // ignore subtotal lines
                        case 'Assignment Income':
                        case 'Total Income':
                        case 'Total Pay':
                        case 'Total Deductions':
                        case 'Net Pay':
                            return;

                        case 'Employees Tax':
                            category = 'Taxes:Income Tax';
                            break;

                        case 'Employee NIC':
                            category = 'Insurance:NI';
                            break;
                    }

                    switch (poundSplit.length - 1) {
                        case 0: return; // ignore
                        case 1: break;

                        case 2:
                            const sp = poundSplit[0].lastIndexOf(' '),
                                units = poundSplit[0].substr(sp + 1);

                            memo = poundSplit[0].substring(0, sp) + ' (' + parseInt(units.trim(), 10) + 'd)';
                            break;
                    }

                    if (amount != 0) {
                        transactions.push(new Transaction(account, {
                            date,
                            payee,
                            amount,
                            category,
                            memo,
                            mode,
                        }, this, this.logger));
                    }
            }
        });

        return transactions;
    }
}

module.exports = GiantAdapter;
