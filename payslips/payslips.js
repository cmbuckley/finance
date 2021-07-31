(function () {
    var formatters = {
        csv: function (rows) {
            return rows.map(function(row) {
                return [
                    row.d.replace(/\d\d(\d\d)$/, '$1'),
                    row.p,
                    ,
                    ,
                    row.m,
                    (row.a / 100).toFixed(2),
                    row.c
                ].join(';');
            }).join('\n');
        },
        qif: function (rows) {
            var name = 'Payslips';
            var type = 'Bank';
            var transfers = {
                'EE Smart Pension': 'Pension'
            };

            var head = [
                '!Account',
                'N' + name,
                'T' + type,
                '^',
                '!Type:' + type
            ];

            return rows.reduce(function (data, row) {
                return data.concat([
                    'D' + row.d,
                    'T' + (row.a / 100).toFixed(2),
                    'M' + row.m,
                    'L' + (transfers[row.m] ? '[' + transfers[row.m] + ']' : row.c),
                    'P' + row.p,
                    '^'
                ]);
            }, head).join('\n');
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
                    .innerText.trim().replace(/\//g, '-');
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
        file = [];

    ['Earnings', 'Statutory Deductions', 'Deductions'].forEach(function (type) {
        // find the table and grab all transactions for that type
        Array.prototype.some.call(headings, function (heading) {
            var transactions;

            if (heading.innerText == type) {
                transactions = parentNode(heading, '[data-automation-id="rivaWidget"]').querySelectorAll('tbody tr');
                console.debug(type, ':', transactions);

                // add all transactions to file
                Array.prototype.forEach.call(transactions, function (transaction) {
                    var cells = transaction.querySelectorAll('td'),
                        description = getDescription(cells, type == 'Earnings'),
                        amount = getAmount(cells, type);

                    if (description && cells.length > 2 && amount != 0) {
                        file.push({
                            d: date,
                            p: getPayee(description),
                            m: description,
                            a: amount,
                            c: getCategory(description)
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

    function getDescription(cells, hasHours) {
        var description = cells[0].innerText.trim().replace("'", ''),
            hours = cells[2] ? cells[2].innerText.trim() * 1 : 0;

        return description + (hasHours && hours > 0 ? ': ' + hours: '');
    }

    function getAmount(cells, type) {
        var column = {Earnings: 4, 'Statutory Deductions': 3, Deductions: 1},
            text = cells[column[type]].innerText;

        return 100 * text.replace(/[(),]/g, '') * (type == 'Earnings' && text.indexOf('(') == -1 ? 1 : -1);
    }

    function getCategory(text) {
        if (text.indexOf('Overtime') > -1) {
            return 'Salary:Overtime';
        }

        return {
            'Monthly Salary':            'Salary:Gross Pay',
            'Call Out':                  'Salary:Gross Pay',
            'Refer a Friend Bonus':      'Salary:Bonus',
            'Company Performance Bonus': 'Salary:Bonus',
            'Commitment Bonus':          'Salary:Bonus',
            'Thank You Bonus':           'Salary:Bonus',
            'TABLETS':                   'Computing:Hardware',
            'EE Smart Pension':          'Retirement:Pension',
            'Income Tax':                'Taxes:Income Tax',
            'Employee NI':               'Insurance:NI',
            'Pennies From Heaven':       'Donations',
        }[text] || '';
    }

    function getPayee(text) {
        if (getCategory(text).split(':')[0] == 'Salary' || text == 'Pennies From Heaven') {
            return 'Sky Bet';
        }

        return '';
    }

    var type = 'qif';
    var output = formatters[type](file);
    var test = document.getElementById('test-output');

    console.log('Transactions:', file);

    if (test) {
        test.value = output;
        var expected = document.getElementById('expected-output').innerText.trim();
        test.classList.add(output.trim() == expected ? 'pass' : 'fail');
    } else {
        var a = document.createElement('a');
        a.download = 'payslips-' + date + '.' + type;
        a.href = 'data:text/' + type + ';base64,' + btoa(output);
        document.body.appendChild(a);
        a.click();
    }
})();
