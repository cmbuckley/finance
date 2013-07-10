(function(doc){
    var type = 'qif'; // type
    var file = []; // file
    var id = doc.getElementById.bind(doc);
    var sel = doc.querySelectorAll.bind(doc);
    var date = id('lblHeading1').innerText.replace(
        /.+the (\d\d) (\w{3}).* (\d{4}).*$/,
        function(_, d, m, y) {
            return d + '-' + ("0" + ['_', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m)).substr(-2) + '-' + y;
        }
    );

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
        return {'P':'', 'D':'-'}[element.id[3]] + id(element.id.replace(/(lbl.)D(\d+)/, '$1A$2')).innerText;
    }

    function getPaymode(text) {
        return {
            'SAYE': 5
        }[text] || 0;
    }

    function getCategory(text) {
        return {
            'BASIC PAY':     'Salary:Gross Pay',
            'SMART PENSION': 'Retirement:Pension',
            'TAX':           'Taxes:Income Tax',
            'NI':            'Insurance:NI'
        }[text] || '';
    }

    var formatters = {
        csv: function (rows) {
            return rows.map(function(row) {
                return [row.d.replace(/\d\d(\d\d)$/, '$1'), row.p, , , row.m, row.a, row.c].join(';');
            }).join('\n');
        },
        qif: function (rows) {
            var transfers = {
                'SAYE 2012 3YR': 'ShareSave'
            };

            function _account(records, name, type) {
                type = type || 'Bank';
                var head = ['!Account', 'N' + name, 'T' + type, '^', '!Type:' + type].join('\n');

                return [head].concat(records.map(function (record) {
                    var category = (transfers[record.m] ? '[' + transfers[record.m] + ']' : record.c);
                    return ['D' + record.d, 'T' + record.a, 'M' + record.m, 'L' + category, '^'].join('\n');
                })).join('\n');
            }

            function _transfers(records, from, to, type) {
                return _account(records.map(function (record) {
                    if (transfers[record.m] !== to) {
                        return false;
                    }

                    record.c = '[' + from + ']';
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
    }

    var a = doc.createElement('a');
    a.download = date + '.' + type;
    a.href = 'data:text/' + type + ';base64,' + btoa(formatters[type](file));
    doc.body.appendChild(a);
    a.click();
})(document);