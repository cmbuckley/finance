// ==UserScript==
// @name         Payslip QIF
// @namespace    https://cmbuckley.co.uk/
// @version      2.1
// @description  add button to download payslip as QIF
// @author       You
// @match        https://answerdigitalltd.sage.hr/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/cmbuckley/finance/main/payslips/tampermonkey.js
// ==/UserScript==

(function() {
    'use strict';
    const oldXHR = window.XMLHttpRequest;

    window.XMLHttpRequest = function newXHR() {
        const realXHR = new oldXHR();
        realXHR.addEventListener('readystatechange', function() {
            if (realXHR.readyState == 4 && realXHR.status == 200 && /directory\/\d+\/payslips/.test(this.responseURL)) {
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
                        'Salary sacrifice': 'Pension',
                    };

                    // get unique account names
                    return [...new Set(rows.map(t => t.account))].reduce(function (output, name) {
                        const head = [
                            '!Account',
                            'N' + name,
                            'TBank',
                            '^',
                            '!Type:Bank'
                        ];

                        return output + rows.reduce(function (accountData, row) {
                            if (row.account != name) { return accountData; }

                            return accountData.concat([
                                'D' + row.date,
                                'T' + (row.amount / 100).toFixed(2),
                                'M' + row.memo,
                                'L' + (transfers[row.memo] ? '[' + transfers[row.memo] + ']' : row.category),
                                'P' + row.payee,
                                '^'
                            ]);
                        }, head).join('\n') + '\n';
                    }, '');
                }
            };

            let transactions = [];
            const amountPositions = {Payments: 4, Deductions: 2};
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
                date = new Date(date + ' 00:00:00+00:00').toISOString().substr(0, 10);
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
                        const cells = row.querySelectorAll('td');
                        const memo = cells[0].textContent;
                        if (memo == 'Total') { return; }

                        transactions.push({
                            date,
                            memo,
                            payee:    getPayee(memo),
                            amount:   getAmount(cells, firstHeading.textContent),
                            category: getCategory(memo),
                            account: 'Payslips',
                        });
                    });
                }
            });

            function parentNode(el, selector) {
                while (el && el.parentNode) {
                    el = el.parentNode;
                    if (el.matches && el.matches(selector)) {
                        return el;
                    }
                }
            }

            function getAmount(cells, type) {
                const text = cells[amountPositions[type] - 1].textContent;

                return 100 * text.replace(/[(),]/g, '') * (['Payments'].includes(type) && text.indexOf('(') == -1 ? 1 : -1);
            }

            function getCategory(text) {
                return {
                    'Salary1':            'Salary:Gross Pay',
                    'PAYE tax':           'Taxes:Income Tax',
                    'National Insurance': 'Insurance:NI',
                }[text] || '';
            }

            function getPayee(text) {
                return {
                    'Salary1':            'Answer Digital',
                    'PAYE tax':           'HMRC',
                    'National Insurance': 'HMRC',
                }[text] || '';
            }

            function getAccount(text) {
                return 'Payslips';
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
