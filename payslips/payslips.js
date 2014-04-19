(function(doc){
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
                'SAYE 2012 3YR': 'ShareSave',
                'SMART PENSION': 'Pension'
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

    var id = doc.getElementById.bind(doc);
    var sel = doc.querySelectorAll.bind(doc);
    var date = id('lblHeading1');

    if (!date) {
        return window.formatters = formatters;
    }

    date = date.innerText.replace(
        /.+the (\d\d) (\w{3}).* (\d{4}).*$/,
        function(_, d, m, y) {
            return d + '-' + ("0" + ['_', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m)).substr(-2) + '-' + y;
        }
    );

    var file = [];
    var type = 'qif';
    var payments = sel('[id^=lblPD]:not(:empty), [id^=lblDD]:not(:empty)');
    var lblPattern = /(lbl.)D(\d+)/;

    [].forEach.call(payments, function (payment) {
        var amount = getAmount(payment);

        if (amount != 0) {
            file.push({
                d: date,
                p: getPaymode(payment.innerText),
                m: getDescription(payment),
                a: amount,
                c: getCategory(payment.innerText)
            });
        }
    });

    function getDescription(element) {
        return [
            element.innerText,
            (id(element.id.replace(lblPattern, '$1H$2')) || {}).innerText
        ].filter(Boolean).join(': ');
    }

    function getAmount(element) {
        var label = id(element.id.replace(lblPattern, '$1A$2'));
        return {'P': 100, 'D': -100}[element.id[3]] * label.innerText.replace(',', '');
    }

    function getPaymode(text) {
        return {
            'SAYE': 5
        }[text] || 0;
    }

    function getCategory(text) {
        if (text.indexOf('O/T HRS') > -1) {
            return 'Salary:Overtime';
        }

        return {
            'BASIC PAY':      'Salary:Gross Pay',
            'CALL OUT':       'Salary:Gross Pay',
            'BONUS':          'Salary:Bonus',
            'REFER A FRIEND': 'Salary:Bonus',
            'SMART PENSION':  'Retirement:Pension',
            'TAX':            'Taxes:Income Tax',
            'NI':             'Insurance:NI'
        }[text] || '';
    }

    var output = formatters[type](file);
    var test = id('test-output');

    if (test) {
        test.innerText = output;
    } else {
        var a = doc.createElement('a');
        a.download = 'payslips-' + date + '.' + type;
        a.href = 'data:text/' + type + ';base64,' + btoa(output);
        doc.body.appendChild(a);
        a.click();
    }
})(document);
