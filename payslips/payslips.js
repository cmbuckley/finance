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

    var $paymentDate = $('table:not([aria-hidden]) span:contains("Payment Date")');

    if (!$paymentDate.length) {
        return window.formatters = formatters;
    }

    var date = $paymentDate.parents('tr')
                          .closest('div')
                          .next()
                          .find('td')
                          .eq($paymentDate.parents('td').index())
                          .text().replace(/\//g, '-');

    var file = [];
    var payments = $('span:contains("Earnings")').parents('div[role=group]').find('div.wd-StitchedGrid .grid-body-row tr');

    payments.each(function () {
        var $cells = $(this).find('td'),
            isEarnings = ($cells.length == 7),
            description = getDescription($cells),
            amount = getAmount($cells, isEarnings);

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

    function getDescription($cells) {
        var description = $cells.eq(0).text().replace("'", ''),
            hours = $cells.eq(2).text() * 1;

        return description + (hours > 0 ? ': ' + hours: '');
    }

    function getAmount($element, isEarnings) {
        var text = $element.eq(isEarnings ? 4 : 1).text();
        return 100 * text.replace(/[(),]/g, '') * (isEarnings && text.indexOf('(') == -1 ? 1 : -1);
    }

    function getCategory(text) {
        if (text.indexOf('Overtime') > -1) {
            return 'Salary:Overtime';
        }

        return {
            'Monthly Salary':       'Salary:Gross Pay',
            'Call Out':             'Salary:Gross Pay',
            'Refer a Friend Bonus': 'Salary:Bonus',
            'Performance Bonus':    'Salary:Bonus',
            'TABLETS':              'Computing:Hardware',
            'EE Smart Pension':     'Retirement:Pension',
            'Income Tax':           'Taxes:Income Tax',
            'Employee NI':          'Insurance:NI'
        }[text] || '';
    }

    var type = 'qif';
    var output = formatters[type](file);
    var $test = $('#test-output');

    if ($test.length) {
        $test.text(output);
        var expected = $('#expected-output').text().trim();
        $test.addClass(output.trim() == expected ? 'pass' : 'fail');
    } else {
        $('<a />', {
            download: 'payslips-' + date + '.' + type,
            href: 'data:text/' + type + ';base64,' + btoa(output)
        })[0].click();
    }
})();
