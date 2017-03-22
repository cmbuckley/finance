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
                    '^'
                ]);
            }, head).join('\n');
        }
    };

    // find all the header cells
    var cells = document.querySelectorAll('td[role="columnheader"]'),
        date;

    // find the Payment Date header cell and get the date from the info table
    Array.prototype.some.call(cells, function (cell) {
        if (cell.innerText.trim() == 'Payment Date') {
            var index = Array.prototype.indexOf.call(cell.parentNode.children, cell) + 1;

            date = parentNode(cell, 'div').nextElementSibling
                                          .querySelector('td:nth-child(' + index + ')')
                                          .innerText.trim().replace(/\//g, '-');
            return true;
        }
    });

    if (date) {
        console.log('Payment date:', date);
    }
    else {
        console.log('No payment date found, exiting');
        return window.formatters = formatters;
    }

    // find all the table headings
    var headings = document.querySelectorAll('div[data-automation-id="gridToolbar"] span.gwt-InlineLabel'),
        file = [];

    ['Earnings', 'Statutory Deductions', 'Deductions'].forEach(function (type) {
        // find the table and grab all transactions for that type
        Array.prototype.some.call(headings, function (heading) {
            var transactions;

            if (heading.innerText == type) {
                transactions = parentNode(heading, 'div.wd-SuperGrid').querySelectorAll('tr[tabindex]');
                console.debug(type, ':', transactions);

                // add all transactions to file
                Array.prototype.forEach.call(transactions, function (transaction) {
                    var cells = transaction.querySelectorAll('td'),
                        isEarnings = (cells.length == 6),
                        description = getDescription(cells, isEarnings),
                        amount = getAmount(cells, isEarnings);

                    if (description && amount != 0) {
                        file.push({
                            d: date,
                            p: 0,
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
            hours = cells[2].innerText.trim() * 1;

        return description + (hasHours && hours > 0 ? ': ' + hours: '');
    }

    function getAmount(cells, isEarnings) {
        var text = cells[isEarnings ? 4 : 1].innerText;
        return 100 * text.replace(/[(),]/g, '') * (isEarnings && text.indexOf('(') == -1 ? 1 : -1);
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
            'TABLETS':                   'Computing:Hardware',
            'EE Smart Pension':          'Retirement:Pension',
            'Income Tax':                'Taxes:Income Tax',
            'Employee NI':               'Insurance:NI',
            'Pennies From Heaven':       'Donations'
        }[text] || '';
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
