(function () {
    var formatters = {
        csv: function (rows) {
            return rows.map(function(row) {
                return [
                    row.n,
                    row.d.replace(/\d\d(\d\d)$/, '$1'),
                    row.p,
                    row.m,
                    (row.a / 100).toFixed(2),
                    row.c
                ].join(';');
            }).join('\n');
        },
        qif: function (rows) {
            var transfers = {
                'EE Smart Pension': 'Pension',
                'Shares':           'Shares',
            };

            // get unique account names
            return [...new Set(rows.map(t => t.n))].reduce(function (output, name) {
                var head = [
                    '!Account',
                    'N' + name,
                    'TBank',
                    '^',
                    '!Type:Bank'
                ];

                return output + rows.reduce(function (accountData, row) {
                    if (row.n != name) { return accountData; }

                    return accountData.concat([
                        'D' + row.d,
                        'T' + (row.a / 100).toFixed(2),
                        'M' + row.m,
                        'L' + (transfers[row.m] ? '[' + transfers[row.m] + ']' : row.c),
                        'P' + row.p,
                        '^'
                    ]);
                }, head).join('\n') + '\n';
            }, '');
        }
    };

    // find all the header cells
    var cells = document.querySelectorAll('tr[data-automation-id="tableHeaderRow"] th span'),
        date;

    // find the Payment Date header cell and get the date from the info table
    Array.prototype.some.call(cells, function (cell) {
        if (cell.innerText.trim() == 'Payment Date') {
            var header = parentNode(cell, 'th'),
                index = Array.prototype.indexOf.call(header.parentNode.children, header) + 1;

            date = parentNode(cell, 'thead').nextElementSibling
                    .querySelector('td:nth-child(' + index + ')')
                    .innerText.trim().split('/').reverse().join('-');
            return true;
        }
    });

    if (date) {
        date = new Date(date + ' 00:00:00+00:00').toISOString().substr(0, 10);
        console.log('Payment date:', date);
    }
    else {
        console.log('No payment date found, exiting');
        return window.formatters = formatters;
    }

    // find all the table headings
    var headings = document.querySelectorAll('[data-automation-id="gridToolbar"] span.gwt-InlineLabel'),
        amountPositions = {Earnings: 4, 'Statutory Deductions': 3, Deductions: 1, 'Employer Costs': 1},
        file = [];

    Object.keys(amountPositions).forEach(function (type) {
        // find the table and grab all transactions for that type
        Array.prototype.some.call(headings, function (heading) {
            var transactions;

            if (heading.innerText == type) {
                transactions = parentNode(heading, '[data-automation-id="rivaWidget"]').querySelectorAll('tbody tr');
                console.debug(type, ':', transactions);

                // add all transactions to file
                Array.prototype.forEach.call(transactions, function (transaction) {
                    var cells = transaction.querySelectorAll('td'),
                        description = getDescription(cells, type),
                        amount = getAmount(cells, type);

                    if (description && cells.length > 2 && amount != 0) {
                        file.push({
                            d: date,
                            p: getPayee(description),
                            m: description,
                            a: amount,
                            c: getCategory(description),
                            n: getAccount(description),
                        });
                    }
                });

                return true;
            }
        });
    });

    function parentNode(el, selector) {
        while (el && el.parentNode) {
            el = el.parentNode;
            if (el.matches && el.matches(selector)) {
                return el;
            }
        }
    }

    function getDescription(cells, type) {
        var description = cells[0].innerText.trim().replace("'", ''),
            hours = cells[2] ? cells[2].innerText.trim() * 1 : 0;

        if (type == 'Employer Costs' && description != 'ER Smart Pension') { return ''; }
        return description + (type =='Earnings' && hours > 0 ? ': ' + hours: '');
    }

    function getAmount(cells, type) {
        var text = cells[amountPositions[type]].innerText;

        return 100 * text.replace(/[(),]/g, '') * (['Earnings', 'Employer Costs'].includes(type) && text.indexOf('(') == -1 ? 1 : -1);
    }

    function getCategory(text) {
        let map = {
            Overtime: 'Salary:Overtime',
            Bonus:    'Salary:Bonus',
            Pension:  'Retirement:Pension',
        }

        for (var k of Object.keys(map)) {
            if (~text.indexOf(k)) {
                return map[k];
            }
        }

        return {
            'Miscellaneous Deduction (Net)': 'Salary:Bonus',
            'Monthly Salary':                'Salary:Gross Pay',
            'Call Out':                      'Salary:Gross Pay',
            'TABLETS':                       'Computing:Hardware',
            'Income Tax':                    'Taxes:Income Tax',
            'Employee NI':                   'Insurance:NI',
            'Pennies From Heaven':           'Donations',
        }[text] || '';
    }

    function getPayee(text) {
        if (getCategory(text).split(':')[0] == 'Salary') {
            return 'Sky Bet';
        }

        if (['ER Smart Pension', 'Shares', 'Miscellaneous Deduction (Net)'].includes(text)) {
            return 'Sky Bet';
        }

        if (text == 'Pennies From Heaven') {
            return 'Pennies From Heaven';
        }

        return '';
    }

    function getAccount(description) {
        return (description == 'ER Smart Pension' ? 'Pension' : 'Payslips');
    }

    var type = 'qif';
    var output = formatters[type](file);
    var test = document.getElementById('test-output');

    console.log('Transactions:', file);

    if (test) {
        test.value = output;
    } else {
        var a = document.createElement('a');
        a.download = 'payslips-' + date + '.' + type;
        a.href = 'data:text/' + type + ';base64,' + btoa(output);
        document.body.appendChild(a);
        a.click();
    }
})();
