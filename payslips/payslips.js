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
            var transfers = {
                'SAYE 2012 3YR': 'ShareSave'
            };

            function _account(records, name, type) {
                type = type || 'Bank';
                var head = [
                    '!Account',
                    'N' + name,
                    'T' + type,
                    '^',
                    '!Type:' + type
                ].join('\n');

                return [head].concat(records.map(function (record) {
                    var category = record.l || (transfers[record.m] ? '[' + transfers[record.m] + ']' : record.c);
                    return ['D' + record.d, 'T' + (record.a / 100).toFixed(2), 'M' + record.m, 'L' + category, '^'].join('\n');
                })).join('\n');
            }

            function _transfers(records, from, to, type) {
                return _account(records.map(function (record) {
                    if (transfers[record.m] !== to) {
                        return false;
                    }

                    record.l = '[' + from + ']';
                    record.a *= -1;
                    return record;
                }).filter(function (record) {
                    return (record !== false);
                }), to, type);
            }

            return [
                _account(rows, 'Payslips'),
                _transfers(rows, 'Payslips', 'ShareSave')
            ].join('\n');
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

    for (var payment in payments) {
        if (payments.propertyIsEnumerable(payment)) {
            var amount = getAmount(payments[payment]);

            if (amount != 0) {
                file.push({
                    d: date,
                    p: getPaymode(payments[payment].innerText),
                    m: payments[payment].innerText,
                    a: amount,
                    c: getCategory(payments[payment].innerText)
                });
            }
        }
    }

    function getAmount(element) {
        var label = id(element.id.replace(/(lbl.)D(\d+)/, '$1A$2'));
        return {'P': 100, 'D': -100}[element.id[3]] * label.innerText.replace(',', '');
    }

    function getPaymode(text) {
        return {
            'SAYE': 5
        }[text] || 0;
    }

    function getCategory(text) {
        return {
            'BASIC PAY':     'Salary:Gross Pay',
            'BONUS':         'Salary:Bonus',
            'SMART PENSION': 'Retirement:Pension',
            'TAX':           'Taxes:Income Tax',
            'NI':            'Insurance:NI'
        }[text] || '';
    }

    var output = formatters[type](file);
    var test = id('test-output');

    if (test) {
        test.innerText = output;
    } else {
        var a = doc.createElement('a');
        a.download = date + '.' + type;
        a.href = 'data:text/' + type + ';base64,' + btoa(output);
        doc.body.appendChild(a);
        a.click();
    }
})(document);
