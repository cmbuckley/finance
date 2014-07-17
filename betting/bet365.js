(function (doc) {
    function _each(array, callback) {
        Array.prototype.forEach.call(array, callback);
    }

    function _map(array, callback) {
        return Array.prototype.map.call(array, callback);
    }

    function _date(el) {
        return _text(el).replace(/^[\s\S]*(\d\d)\/(\d\d)\/(\d{4})[\s\S]*$/m, '$1-$2-$3');
    }

    function _text(el, html) {
        return el[html ? 'innerHTML' : 'textContent'].trim().replace(/  +/, ' ');
    }

    function _get(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var parser = new DOMParser();
                callback(parser.parseFromString(xhr.responseText, 'text/xml'));
            }
        };

        xhr.send();
    }

    function _getTransaction(el) {
        var data = _getData(el);

        return {
            d: data.date,
            a: (data.stake.returns - data.stake.stake),
            m: _getDescription(data),
            c: 'Leisure:Betting',
            n: data.id
        };
    }

    function _isAccumulator(selections) {
        return selections.reduce(function (soFar, selection) {
            return (soFar && (selection.market == 'Full Time Result'));
        }, true);
    }

    function _getDescription(data) {
        var description = '',
            eventSeparator = ' - ',
            selection;

        if (/Single/.test(data.stake.type)) {
            selection = data.selections[0];
            description = selection.selection;

            if (!~['Win and Each Way', 'Correct Score'].indexOf(selection.market)) {
                if ((selection.market == 'Match Correct Score') ||
                    (selection.market == 'Next Goal' && /goal/i.test(selection.selection))
                ) {
                    eventSeparator = '\n';
                }
                else {
                    if (selection.market != 'Match Goals') {
                        eventSeparator = '\n';
                        description += ' -';
                    }

                    description += ' ' + selection.market;
                }
            }

            if (data.stake.type == 'E/W Single') {
                description += ' (E/W)';
            }

            description += eventSeparator + selection.event;

            if (selection.date != data.date) {
                description += ' (' + selection.date + ')';
            }

            description += '\n' + selection.odds + ' - ' + selection.result;

            if (selection.result == 'Placed') {
                description += ' (' + selection.eachWay + ')';
            }
        }
        else {
            description = data.stake.type;

            if (_isAccumulator(data.selections)) {
                description += ' (' + data.selections.map(function (selection) {
                    return selection.selection;
                }).join(', ') + ')';
            }

            description += '\n' + data.selections.map(function (selection) {
                var text = selection.selection;

                if (selection.date != data.date) {
                   text += ' (' + selection.date + ')';
                }

                text += ' - ' + selection.odds + ' - ' + selection.result;
                return text;
            }).join('\n');
        }

        return description;
    }

    function _getStake(el) {
        var betSelector = '.first.last',
            type = 'Single',
            bet,
            betMatch;

        if (el.querySelector('#optHdr')) {
            type = _text(el.querySelector('#optHdr + tr td.first a'));
            betSelector = '#betfooter';
        }

        bet = _text(el.querySelector(betSelector));
        betMatch = bet.match(/Stake:\D+([\d\.]+)\D+Returns:\D+([\d\.]+)/);

        if (~bet.indexOf('Unit Stake')) {
            type = 'E/W Single';
        }

        return {
            type:    type,
            stake:   betMatch[1] * 100,
            returns: betMatch[2] * 100
        };
    }

    function _getSelections(el) {
        return _map(el.querySelectorAll('tr:not(.header):not(.bogheaders)'), function (row) {
            var cells = row.querySelectorAll('td'),
                event,
                eachWay;

            if (cells.length == 1) { return false; }

            event = cells[2].innerHTML.split(/<br\/?>/);
            eachWay = cells[4].innerHTML.trim().replace(/&nbsp;|\s+/g, ' ').replace(/<br\/?>/, ', ');

            return {
                selection: _text(cells[1]),
                event:     event[0].trim(),
                market:    event[1].trim().replace(/[()]/g, ''),
                date:      _date(cells[3]),
                eachWay:   (eachWay == 'None' ? false : eachWay),
                odds:      _text(cells[5]),
                result:    _text(cells[6])
            };
        }).filter(Boolean);
    }

    function _getData(el) {
        var spans = el.querySelectorAll('span');

        return {
            id:         _text(spans[0]).split('-')[1].trim(),
            date:       _date(spans[1]),
            stake:      _getStake(el),
            selections: _getSelections(el.querySelector('#tblNormal'))
        };
    }

    function _qif(rows) {
        var name = 'Betting',
            type = 'Bank';

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
                'L' + row.c,
                'N' + row.n,
                '^'
            ]);
        }, head).join('\n');
    }

    function _ofx(rows) {
        var head = '<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>GBP</CURDEF>\n<BANKACCTFROM>\n<BANKID></BANKID>\n<ACCTID>Betting</ACCTID>\n<ACCTTYPE></ACCTTYPE>\n</BANKACCTFROM>\n<BANKTRANLIST>\n',
            foot = '</BANKTRANLIST>\n<LEDGERBAL>\n<BALAMT></BALAMT>\n<DTASOF></DTASOF>\n</LEDGERBAL>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n';

        return rows.reduce(function (data, row) {
            return data +
                '<STMTTRN>\n' +
                '   <DTPOSTED>' + row.d.split('-').reverse().join('') + '</DTPOSTED>\n' +
                '   <TRNAMT>' + (row.a / 100).toFixed(2) + '</TRNAMT>\n' +
                '   <FITID>' + row.n + '</FITID>\n' +
                '   <NAME>' + 'bet365' + '</NAME>\n' +
                '   <MEMO>' + row.m + '</MEMO>\n' +
                '</STMTTRN>\n';
        }, head) + foot;
    }

    function _download(rows) {
        var a = doc.createElement('a');
        a.download = 'betting.ofx';
        a.href = 'data:text/ofx;base64,' + btoa(_ofx(rows));
        doc.body.appendChild(a);
        a.click();
    }

    var sel = doc.querySelectorAll.bind(doc);
    var envelope = sel('bet365Envelope');

    if (envelope.length) {
        _download([_getTransaction(envelope[0])]);
    }
    else {
        var rows = sel('.betResultsRow');
        var file = [];

        _each(rows, function (row) {
            var url = '/MEMBERS/Authenticated/History/GetBetTransaction.aspx?bsttId=2&bsId=' + row.id.replace(/_.*$/, '');

            _get(url, function (el) {
                file.push(_getTransaction(el));

                if (file.length == rows.length) {
                    _download(file);
                }
            });
        });
    }
})(document);
