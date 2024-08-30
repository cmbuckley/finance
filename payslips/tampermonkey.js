// ==UserScript==
// @name         Payslip QIF
// @namespace    https://cmbuckley.co.uk/
// @version      2.20
// @description  add button to download payslip as QIF
// @author       chris@cmbuckley.co.uk
// @match        https://*.sage.hr/*
// @grant        none
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/cmbuckley/finance/main/payslips/tampermonkey.js
// @updateURL    https://raw.githubusercontent.com/cmbuckley/finance/main/payslips/tampermonkey.js
// ==/UserScript==

(function() {
    'use strict';
    const oldXHR = window.XMLHttpRequest;

    window.XMLHttpRequest = function newXHR() {
        const realXHR = new oldXHR();
        realXHR.addEventListener('readystatechange', function() {
            if (realXHR.readyState == 4 && realXHR.status == 200 && /directory\/\d+\/payslips\//.test(this.responseURL)) {
                setTimeout(payslipLoaded);
            }
        }, false);
        return realXHR;
    };
    window.XMLHttpRequest.tampered = true;

    function payslipLoaded() {
        console.log('Payslip loaded');
        addButton('QIF');
    }

    function addButton(type) {
        const pdf = document.querySelector('.download-payslips-modal-btn');

        const btn = document.createElement('a');
        btn.classList.add('btn');
        btn.addEventListener('click', download(type.toLowerCase()));

        const span = document.createElement('span');
        span.classList.add('button-text');
        span.innerHTML = 'Download ' + type;

        btn.appendChild(span);
        pdf.parentNode.insertBefore(btn, pdf);
    }

    function getPayDate(dateString) {
        let date = new Date(dateString + ' 00:00:00+00:00'),
            lastFridayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        if (lastFridayOfMonth.getDay() < 5) {
            lastFridayOfMonth.setDate(lastFridayOfMonth.getDate() - 7);
        }

        lastFridayOfMonth.setDate(lastFridayOfMonth.getDate() - (lastFridayOfMonth.getDay() - 5));
        return lastFridayOfMonth;
    }

    function download(type) {
        return function () {
            const formatters = {
                csv: function (rows) {
                    return rows.map(function(row) {
                        return [
                            row.account,
                            row.date,
                            row.payee,
                            row.memo,
                            (row.amount / 100).toFixed(2),
                            row.category
                        ].join(',');
                    }).join('\n');
                },
                qif: function (rows) {
                    const transfers = {
                        'Salary sacrifice': 'Pentelow Pension',
                    };

                    // get unique account names
                    return Array.from(new Set(rows.map(t => t.account))).reduce(function (output, name) {
                        const head = [
                            '!Account',
                            'N' + name,
                            'TBank',
                            '^',
                            '!Type:Bank'
                        ];

                        return output + rows.reduce(function (accountData, row) {
                            if (row.account != name || !row.amount) { return accountData; }

                            return accountData.concat([
                                'D' + row.date,
                                'T' + (row.amount / 100).toFixed(2),
                                'M' + row.memo,
                                'L' + (transfers[row.memo] ? '[' + transfers[row.memo] + ']' : row.category),
                                'P' + (transfers[row.memo] ? '' : row.payee),
                                '^'
                            ]);
                        }, head).join('\n') + '\n';
                    }, '');
                }
            };

            let transactions = [];
            const amountPositions = {Payments: 4, Deductions: 2, 'This period': 2};
            const memoFilter = {'This period': ['Employer pension']};
            let date;

            // find the payment date header cell and get the date from the table
            document.querySelectorAll('.modal-content th').forEach(header => {
                if (header.textContent == 'Process date') {
                    const index = Array.prototype.indexOf.call(header.parentNode.children, header) + 1;
                    const cell = parentNode(header, 'table').querySelector('tbody tr td:nth-child(' + index + ')');
                    date = cell.textContent.trim().split('/').reverse().join('-');
                }
            });

            if (date) {
                // toISOString gets UTC date. Using Sweden locale gets ISO format
                date = getPayDate(date).toLocaleDateString('sv');
                console.log('Payment date:', date);
            }
            else {
                console.log('No payment date found, exiting');
                window.formatters = formatters;
                return;
            }

            // check each table for transactions
            document.querySelectorAll('.modal-content table.listings').forEach(table => {
                const firstHeading = table.querySelector('th');
                if (firstHeading && Object.keys(amountPositions).includes(firstHeading.textContent)) {
                    table.querySelectorAll('tbody tr').forEach(row => {
                        const cells = Array.from(row.querySelectorAll('td')).map(c => c.textContent.trim());
                        const memo = cells[0];

                        if (shouldInclude(memo, firstHeading.textContent)) {
                            let units = cells[1],
                                memoExtra = '';

                            if (firstHeading.textContent == 'Payments' && units != 0 && units != 1) {
                                units = Math.abs(units);
                                if (units < 1) units = toFraction(units);
                                if (memo == 'Overtime') units /= 7.5;
                                memoExtra = ` (${units}d)`;
                            }

                            transactions.push({
                                date,
                                memo:     memo + memoExtra,
                                payee:    getPayee(memo),
                                amount:   getAmount(cells, firstHeading.textContent, transactions),
                                category: getCategory(memo),
                                account:  getAccount(memo),
                            });
                        }
                    });
                }
            });

            // convert a decimal to fraction
            // can specify the size of the num/denom matrix
            function toFraction(decimal, size = 31) {
                return [...Array(size)].flatMap(
                    (_, n) => [...Array(size)].map(
                        (_, d) => [
                            n + 1, d + 1,
                            Math.abs(((n + 1) / (d + 1)) - decimal)
                        ]
                    )
                ).sort((a, b) => a[2] - b[2])[0].slice(0, 2).join('/');
            }

            function shouldInclude(memo, heading) {
                if (memo == 'Total') { return false; }
                if (!memoFilter[heading]) { return true; }
                return memoFilter[heading].includes(memo);
            }

            function parentNode(el, selector) {
                while (el && el.parentNode) {
                    el = el.parentNode;
                    if (el.matches && el.matches(selector)) {
                        return el;
                    }
                }
            }

            function getAmount(cells, type, transactions) {
                const text = cells[amountPositions[type] - 1];

                let amount = 100 * text.replace(/[(),]/g, '') * (['Payments', 'This period'].includes(type) && text.indexOf('(') == -1 ? 1 : -1);

                // "Employer pension" is actually a combination of employer and employee
                if (cells[0] == 'Employer pension') {
                    amount += transactions.find(t => t.memo == 'Salary sacrifice').amount;
                }

                return amount;
            }

            function getCategory(text) {
                return {
                    'Salary1':              'Salary:Gross Pay',
                    'Monthly Salary':       'Salary:Gross Pay',
                    'Answer Paternity Pay': 'Salary:Gross Pay',
                    'EOT Bonus':            'Salary:Bonus',
                    'Overtime':             'Salary:Overtime',
                    'Holiday Pay':          'Salary:Gross Pay',
                    'Holiday Sold':         'Salary:Gross Pay',
                    'PAYE tax':             'Taxes:Income Tax',
                    'National Insurance':   'Insurance:NI',
                    'Employer pension':     'Retirement:Pension',
                }[text] || '';
            }

            function getPayee(text) {
                return {
                    'PAYE tax':           'HMRC',
                    'National Insurance': 'HMRC',
                }[text] || 'Answer Digital';
            }

            function getAccount(text) {
                return {
                    'Employer pension': 'Pentelow Pension',
                }[text] || 'Payslips';
            }

            const output = formatters[type](transactions);
            console.log('Transactions:', transactions);

            const a = document.createElement('a');
            a.download = 'payslips-' + date + '.' + type;
            a.href = 'data:text/' + type + ';base64,' + btoa(output);
            document.body.appendChild(a);
            a.click();
        };
    }
})();
