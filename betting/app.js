(function (exports) {
    // utility functions
    var utils = {
        $: exports.document.querySelectorAll.bind(exports.document),

        each: function (array, callback) {
            Array.prototype.forEach.call(array, callback);
        },

        map: function (array, callback) {
            return Array.prototype.map.call(array, callback);
        },

        text: function (el, html) {
            return el[html ? 'innerHTML' : 'textContent'].trim().replace(/  +/, ' ');
        },

        ajax: function (url, callback) {
            console.info('Making Ajax call:', url);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);

            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    var parser = new DOMParser();
                    callback(parser.parseFromString(xhr.responseText, 'text/xml'));
                }
            };

            xhr.send();
        },

        download: function (name, format, rows) {
            format = format || 'ofx';

            var a = exports.document.createElement('a'),
                output = outputters[format](rows);

            a.download = [name, format].join('.');
            a.href = 'data:text/' + format + ';base64,' + exports.btoa(output);
            exports.document.body.appendChild(a);
            a.click();
        }
    };

    // output handlers
    var outputters = {
        qif: function (rows) {
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
                    'D' + row.date,
                    'T' + (row.amount / 100).toFixed(2),
                    'M' + row.memo,
                    'L' + row.category,
                    'N' + row.id,
                    '^'
                ]);
            }, head).join('\n');
        },

        ofx: function (rows) {
            var head = '<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>GBP</CURDEF>\n<BANKACCTFROM>\n<BANKID></BANKID>\n<ACCTID>Betting</ACCTID>\n<ACCTTYPE></ACCTTYPE>\n</BANKACCTFROM>\n<BANKTRANLIST>\n',
                foot = '</BANKTRANLIST>\n<LEDGERBAL>\n<BALAMT></BALAMT>\n<DTASOF></DTASOF>\n</LEDGERBAL>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n';

            return rows.reduce(function (data, row) {
                return data +
                    '<STMTTRN>\n' +
                    '   <DTPOSTED>' + row.date.split('-').reverse().join('') + '</DTPOSTED>\n' +
                    '   <TRNAMT>' + (row.amount / 100).toFixed(2) + '</TRNAMT>\n' +
                    '   <FITID>' + row.id + '</FITID>\n' +
                    '   <CHECKNUM>' + row.id + '</CHECKNUM>\n' +
                    '   <NAME>' + row.payee + '</NAME>\n' +
                    '   <MEMO>' + row.memo + '</MEMO>\n' +
                    '</STMTTRN>\n';
            }, head) + foot;
        }
    };

    // betting site handlers
    var handlers = {
        bet365: {
            getElements: function (callback) {
                var envelope = utils.$('bet365Envelope');

                if (envelope.length) {
                    callback(envelope);
                }
                else {
                    rows = utils.$('.betResultsRow');
                    var elements = [];

                    utils.each(rows, function (row) {
                        var d = row.querySelector('.transLink').getAttribute('onclick').match(/'([^']+)'/)[1].split('#'),
                            url = '/MEMBERS/Authenticated/History/GetBetTransaction.aspx?bsId=' + d[0] + '&bsttId=' + d[1] + '&dsId=' + d[2] + '&ht=' + d[3];

                        utils.ajax(url, function (el) {
                            elements.push(el);

                            if (elements.length == rows.length) {
                                callback(elements);
                            }
                        });
                    });
                }
            },

            getTransactionId: function (el) {
                return utils.text(el.querySelector('span')).split('-')[1].trim();
            },

            getTransactionDate: function (el) {
                return this._getDate(el.querySelectorAll('span')[1]);
            },

            getStake: function (el) {
                var betSelector = '.first.last',
                    type = 'Single',
                    bet,
                    betMatch;

                if (el.querySelector('#optHdr')) {
                    type = utils.text(el.querySelector('#optHdr + tr td.first a'));
                    betSelector = '#betfooter';
                }

                bet = utils.text(el.querySelector(betSelector));
                console.debug('Parsing stake/returns:', bet.replace(/\s+/g, ' '));
                betMatch = bet.match(/Stake:\D+([\d\.]+)\D+Returns:\D*([\d\.]*)/);

                if (~bet.indexOf('Unit Stake')) {
                    type = 'E/W Single';
                }

                return {
                    type:    type,
                    stake:   betMatch[1] * 100,
                    returns: betMatch[2] * 100
                };
            },

            getSelections: function (el) {
                return utils.map(el.querySelectorAll('#tblNormal tr:not(.header):not(.bogheaders)'), function (row) {
                    var cells = row.querySelectorAll('td'),
                        event,
                        eachWay;

                    if (cells.length == 1) {
                        return false;
                    }

                    event = cells[2].innerHTML.split(/<br\/?>/);
                    eachWay = cells[4].innerHTML.trim().replace(/&nbsp;|\s+/g, ' ').replace(/<br\/?>/, ', ');

                    return {
                        selection: utils.text(cells[1]),
                        event:     event[0].trim(),
                        market:    event[1].trim().replace(/[()]/g, ''),
                        date:      this._getDate(cells[3]),
                        eachWay:   (eachWay == 'None' ? false : eachWay),
                        odds:      utils.text(cells[5]),
                        result:    utils.text(cells[6])
                    };
                }.bind(this)).filter(Boolean);
            },

            _getDate: function (el) {
                return utils.text(el).replace(/^[\s\S]*(\d\d)\/(\d\d)\/(\d{4})[\s\S]*$/m, '$1-$2-$3');
            },
        },

        betvictor: {
            name: 'BetVictor',

            getElements: function (callback) {
                callback(utils.$('#account_history .transaction_block'));
            },

            getTransactionId: function (el) {
                return utils.text(el.querySelector('.bet_title')).replace(/^\D*(\d+)$/, '$1');
            },

            getTransactionDate: function (el) {
                return utils.text(el.querySelector('.headertext')).split(' ')[0].replace(/^[\s\S]*(\d\d)\/(\d\d)\/(\d{4})[\s\S]*$/m, '$1-$2-$3');
            },

            getStake: function (el) {
                return {
                    // @todo "Double" vs "Doubles" etc, "Each Way Single"
                    type:    utils.text(el.querySelector('.headertext')).match(/GBP [\d\.]+ ([^:]+):/)[1],
                    stake:   utils.text(el.querySelector('.bet_title_last')).match(/£ ([\d\.]+)/)[1] * 100,
                    returns: utils.text(el.querySelector('.returns')).match(/£([\d\.]+)/)[1] * 100
                };
            },

            getSelections: function (el) {
                return utils.map(el.querySelectorAll('.transaction_data tr:not(.titles):not(.bet_type)'), function (row) {
                    var cells = row.querySelectorAll('td'),
                        eachWay = utils.text(cells[3]),
                        race = utils.map(el.querySelectorAll('.race'), utils.text),
                        event = race[0],
                        market = utils.text(el.querySelector('.race.details')).replace(/\s+/g,' ');

                    if (race[0].match(/\d{2}:\d{2}/)) {
                        // @todo caps, 17:05 vs 5.05
                        event = race[0] + ' ' + race[1];
                    }

                    if (/To Win Match|Match Betting/.test(market)) {
                        market = 'Full Time Result';
                    }

                    return {
                        selection: utils.text(cells[1]),
                        event:     event,
                        market:    market,
                        date:      '', // @todo check for date
                        eachWay:   (eachWay == 'Win only' ? false : eachWay),
                        odds:      utils.text(cells[2]),
                        result:    utils.text(cells[4])
                    };
                });
            },
        },

        /*skeleton: {
            name: 'Skeleton',
            getElements: function (callback) {},
            getTransactionId: function (el) {},
            getTransactionDate: function (el) {},
            getStake: function (el) {},
            getSelections: function (el) {},
        },*/
    };

    // application
    function App(name) {
        if (!handlers[name]) {
            throw new Error('Invalid handler: ' + name);
        }

        this.handler = handlers[name];
        this.name = name;

        console.info('Using ' + this.name + ' handler');
    }

    App.utils = utils;
    App.prototype = {
        download: function () {
            this.getTransactions(function (transactions) {
                utils.download(this.name, this.handler.format, transactions);
            }.bind(this));
        },

        getTransactions: function (callback) {
            var transactions = [],
                app = this;

            if (!this.handler.getElements) {
                throw new Error(this.name + ' handler must define getElements method');
            }

            this.handler.getElements(function (elements) {
                utils.each(elements, function (element) {
                    var data = app.getData(element);
                    console.debug('Data parsed:', data);
                    transactions.push(app.getTransaction(data));
                });

                callback(transactions);
            })
        },

        getDescription: function (data) {
            var description = '',
                eventSeparator = ' - ',
                selection,
                isAccumulator;

            if (/Single/.test(data.stake.type)) {
                selection = data.selections[0] || {};
                description = selection.selection;

                // types of market that shouldn't be included in the description
                // 365, 365, bv
                if (!~['Win and Each Way', 'Correct Score', 'Horse Racing Outright - Race'].indexOf(selection.market)) {
                    // @todo explain why / examples
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

                // @todo bv
                if (data.stake.type == 'E/W Single') {
                    description += ' (E/W)';
                }

                description += eventSeparator + selection.event;

                if (selection.date && selection.date != data.date) {
                    description += ' (' + selection.date + ')';
                }

                description += '\n' + selection.odds + ' - ' + selection.result;

                if (selection.result == 'Placed') {
                    // @todo bv, split out eachWay
                    description += ' (' + selection.eachWay + ')';
                }
            }
            else {
                description = data.stake.type;
                isAccumulator = data.selections.reduce(function (soFar, selection) {
                    return (soFar && (~['Full Time Result', 'Match Betting - 3 Way'].indexOf(selection.market)));
                }, true);

                if (isAccumulator) {
                    description += ' (' + data.selections.map(function (selection) {
                        return selection.selection;
                    }).join(', ') + ')';
                }

                description += '\n' + data.selections.map(function (selection) {
                    var text = selection.selection; // @todo maybe use market here?

                    if (selection.date && selection.date != data.date) {
                       text += ' (' + selection.date + ')';
                    }

                    text += ' - ' + selection.odds + ' - ' + selection.result;
                    return text;
                }).join('\n');
            }

            return description;
        },

        getData: function (element) {
            ['getTransactionId', 'getTransactionDate', 'getStake', 'getSelections'].forEach(function (method) {
                if (!this.handler[method]) {
                    throw new Error(this.name + ' handler must define ' + method + ' method');
                }
            }.bind(this));

            return {
                id:         this.handler.getTransactionId(element),
                date:       this.handler.getTransactionDate(element),
                stake:      this.handler.getStake(element) || {},
                selections: this.handler.getSelections(element) || [],
            };
        },

        getTransaction: function (data) {
            return {
                date:     data.date,
                amount:   data.stake.returns - data.stake.stake || 0,
                memo:     this.getDescription(data),
                category: 'Leisure:Betting',
                payee:    this.handler.name || this.name,
                id:       data.id,
            };
        }
    };

    exports.App = App;

    // find appropriate handler
    if (exports.location) {
        if (!Object.keys(handlers).some(function (handlerName) {
            if (window.location.hostname.match(new RegExp(handlerName))) {
                new App(handlerName).download();
                return true;
            }
        })) {
            console.warn('No handler for ' + window.location.hostname);
        }
    }
})(this);
