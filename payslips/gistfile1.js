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
            file.push({
                d: date,
                p: getPaymode(payments[payment].innerText),
                m: payments[payment].innerText,
                a: getAmount(payments[payment]),
                c: getCategory(payments[payment].innerText)
            });
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
            'BASIC PAY':     'Income:Pay Slip',
            'SMART PENSION': 'Bills:Pension',
            'TAX':           'Bills:Income Tax',
            'NI':            'Bills:National Insurance',
            'SAYE 2012 3YR': 'Income:Transfer',
            'STUDENT LOAN':  'Income:Student Loan',
        }[text];
    }

    var formatters = {
        csv: function (f) {
            return f.map(function(r) {
                return [r.d.replace(/\d\d(\d\d)$/, '$1'), r.p, , , r.m, r.a, r.c].join(';');
            }).join('\n');
        },
        qif: function (f) {
            var h = ['!Account', 'NPayslips', 'TAsset', '^', '!Type:Oth A'].join('\n');
            return [h].concat(f.map(function (r) {
                return ['D' + r.d, 'T' + r.a, 'M' + r.m, 'L' + r.c, '^'].join('\n');
            })).join('\n');
        }
    }

    var a = doc.createElement('a');
    a.download = date + '.' + type;
    a.href = 'data:text/' + type + ';base64,' + btoa(formatters[type](file));
    doc.body.appendChild(a);
    a.click();
})(document);