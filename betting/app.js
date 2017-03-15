(function (exports) {
    // utility functions
    var utils = {
        $: exports.document.querySelectorAll.bind(exports.document),

        each: function (array, callback, context) {
            Array.prototype.forEach.call(array, callback, context);
        },

        map: function (array, callback, context) {
            // paddypower uses Prototype, which overrides native Array prototype
            return (exports.Prototype ? Array.from(array).map(callback, context) : Array.prototype.map.call(array, callback, context));
        },

        text: function (el, html) {
            return el[html ? 'innerHTML' : 'textContent'].trim().replace(/  +/, ' ');
        },

        titleCase: function (str) {
            return str.replace(/^([a-z])|\s+([a-z])/g, function ($1) {
                return $1.toUpperCase();
            });
        },

        ajax: function (url, callback, contentType) {
            console.info('Making Ajax call:', url);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);

            xhr.onreadystatechange = function () {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    var parser = new DOMParser();
                    callback(parser.parseFromString(xhr.responseText, contentType || 'text/html'));
                }
            };

            xhr.send();
        },

        download: function (name, format, rows) {
            format = format || 'ofx';

            var a = exports.document.createElement('a'),
                output = outputters[format](rows);

            try {
                a.href = 'data:text/' + format + ';charset=utf-8,' + encodeURIComponent(output);
            } catch (e) {
                var bad = output.split('\n').filter(RegExp.prototype.test.bind(/[^\x00-\x7F]/)).join('\n');
                console.error('Output contains invalid characters:\n', bad.replace(/[^\x00-\x7F]/g, '\ufffd'));
                return false;
            }

            a.download = [name, format].join('.');
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

            return rows.reduceRight(function (data, row) {
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
            var head = '<?OFX OFXHEADER="200" ENCODING="UTF-8" ?>\n<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<STMTRS>\n<CURDEF>GBP</CURDEF>\n<BANKACCTFROM>\n<BANKID></BANKID>\n<ACCTID>Betting</ACCTID>\n<ACCTTYPE></ACCTTYPE>\n</BANKACCTFROM>\n<BANKTRANLIST>\n',
                foot = '</BANKTRANLIST>\n<LEDGERBAL>\n<BALAMT></BALAMT>\n<DTASOF></DTASOF>\n</LEDGERBAL>\n</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n';

            return rows.reduceRight(function (data, row) {
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
                var confirmation = utils.$('.bet-confirmation');

                if (confirmation.length) {
                    callback(confirmation);
                }
                else {
                    var historyDoc = exports.document.querySelector('iframe').contentDocument,
                        rows = historyDoc.querySelectorAll('.bet-summary-body-row'),
                        elements = [];

                    utils.each(rows, function (row) {
                        var url = ['/Members/History/SportsHistory/GetBetConfirmation',
                                    '?Id=',        row.getAttribute('data-betid'),
                                    '&BetStatus=', row.getAttribute('data-betstatus'),
                                    '&Bcar=',      row.getAttribute('data-bcar'),
                                    '&Bash=',      row.getAttribute('data-bash'),
                                    '&Pebs=',      row.getAttribute('data-pebs')].join('');

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
                return utils.text(el.querySelector('.bet-confirmation-details-ref')).split('-')[1].trim();
            },

            getTransactionDate: function (el) {
                return this._getDate(el.querySelector('.bet-confirmation-details-timeofbet'));
            },

            getStake: function (el) {
                var type = 'Single',
                    bet, betMatch;

                // TODO check new multiples format
                if (el.querySelector('.multiples-bet-information')) {
                    type = utils.text(el.querySelector('.multiples-bet-information-bet-breakdown'));
                }

                bet = utils.text(el.querySelector('.bet-confirmation-amounts'));
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
                return utils.map(el.querySelectorAll('.bet-confirmation-table-body tr.DefaultLayout'), function (row) {
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
                        result:    utils.text(cells[8])
                    };
                }, this).filter(Boolean);
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
                        event = race[0].replace(':', '.') + ' ' + race[1];
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

        betfair: {
            name: 'Betfair Limited',

            getElements: function (callback) {
                var elements = [],
                    rows = utils.$('#my-bets-table .js-market-group-parent'),
                    current;

                utils.each(rows, function (row) {
                    var element = row.cloneNode(true);

                    if (~element.className.indexOf('child-of')) {
                        current.querySelector('.children').appendChild(element);
                    }
                    else {
                        elements.push(element);

                        if (~element.className.indexOf('expandable-row')) {
                            var wrapper = exports.document.createElement('div');
                            wrapper.classList.add('children');
                            element.appendChild(wrapper);
                            current = element;
                        }
                    }
                });

                callback(elements);
            },

            getTransactionId: function (el) {
                return utils.text(el.querySelector('.bet-id-container')).match(/O\/\d+\/\d+/)[0];
            },

            getTransactionDate: function (el) {
                return this._getDate(el.querySelector('.bet-id-container'));
            },

            getStake: function (el) {
                var type = 'Single';

                if (~el.className.indexOf('expandable-row')) {
                    type = utils.text(el.querySelector('.description .main-title')).replace(/\(.*\)/, '').trim();
                }

                return {
                    type:    type,
                    stake:   utils.text(el.querySelector('.stake')) * 100,
                    returns: utils.text(el.querySelector('.return')) * 100,
                };
            },

            getSelections: function (el) {
                var els = el.querySelectorAll('.children > tr');

                return utils.map(els.length ? els : [el], function (child) {
                    var description = child.querySelector('.description .main-title').innerHTML.split(/<br[^>]*>/),
                        data = [];

                    if (description[1]) {
                        data = description[1].split('-').map(function (str) {
                            return str.trim().replace(/<[^>]+>/g, '');
                        });
                    }

                    return {
                        selection: data[1] || utils.text(child.querySelector('.description .bolded:not(.main-title)')),
                        event:     description[0].trim(),
                        market:    data[0] || child.querySelector('.description').innerHTML.replace(/[\s\S]*> - ([^<]*)<[\s\S]*/, '$1'),
                        date:      els.length ? '' : this._getDate(child.querySelector('.date .main-title')),
                        eachWay:   false,
                        odds:      utils.text(child.querySelector('.odds')),
                        result:    utils.text(child.querySelector('.status')),
                    };
                }, this);
            },

            _getDate: function (el) {
                var yearPrefix = new Date().getFullYear().toString().substr(0, 2),
                    months = ['_','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                return utils.text(el).replace(/.*(\d{2})-(\w{3})-(\d{2}).*/, function (_, d, m, y) {
                    return d + '-' + ('0' + months.indexOf(m)).substr(-2) + '-' + yearPrefix + y;
                });
            },
        },

        paddypower: {
            name: 'Paddy Power',
            getElements: function (callback) {
                var wrapper = exports.document.getElementById('wrapper');

                if (wrapper.querySelector('.bet-receipt-item')) {
                    callback([wrapper]);
                }
                else {
                    var links = utils.$('#history .settled a[onclick]'),
                        total = links.length,
                        urls = [],
                        elements = [];

                    utils.each(links, function (link) {
                        var url = link.getAttribute('onclick').match(/^popup\('([^']+)'/)[1];

                        if (~urls.indexOf(url)) {
                            total--;
                        }
                        else {
                            urls.push(url);
                            utils.ajax(url, function (el) {
                                elements.push(el);

                                if (elements.length == total) {
                                    callback(elements);
                                }
                            });
                        }
                    });
                }
            },

            getTransactionId: function (el) {
                return utils.text(el.querySelector('#ma-header h2')).split(':')[1].trim();
            },

            getTransactionDate: function (el) {
                return this._getDate(this._getData(el)['Bet placed at']);
            },

            getStake: function (el) {
                var data = this._getData(el);

                return {
                    type:    'Single',
                    stake:   data['Total Stake'].replace('£', '') * 100,
                    freebet: data['Freebets Redeemed'].replace('£', '') * 100,
                    returns: data['Total Returns'].replace('£', '') * 100,
                };
            },

            getSelections: function (el) {
                return utils.map(el.querySelectorAll('.bet-receipt-item:nth-child(2) tr'), function (row) {
                    var table = row.querySelector('table');

                    if (!table) {
                        return false;
                    }

                    var data = this._getData(el),
                        selection = data.extra[data.extra.length - 3].split('@'),
                        event = data.extra[5].replace(/^(\d\d):(\d\d).*$/, function (_, h, m) {
                            return (h > 12 ? h - 12 : h) + '.' + m
                                + ' ' + utils.titleCase(data.extra[4].toLowerCase());
                        })

                    return {
                        selection: selection[0].trim(),
                        event:     event,
                        market:    data.extra[7],
                        date:      this._getDate(data.extra[6]),
                        eachWay:   !!~data['Bet type'].indexOf('Each-Way'),
                        odds:      selection[1].trim().match(/\d+\/\d+/)[0],
                        result:    {Win: 'Won', Lose: 'Lost'}[data.extra[data.extra.length - 2]],
                    };
                }, this).filter(Boolean);
            },

            _getData: function (el) {
                var data = {extra: []},
                    details = false,
                    key;

                utils.each(el.querySelectorAll('.bet-receipt-item td:not([rowspan])'), function (row) {
                    var text = utils.text(row);

                    if (text) {
                        if (text == 'Bet placed at') {
                            details = true;
                        }

                        if (details) {
                            if (key) {
                                data[key] = text;
                                key = undefined;
                            }
                            else {
                                key = text;
                            }
                        }
                        else {
                            data.extra.push(text);
                        }
                    }
                });

                return data;
            },

            _getDate: function (str) {
                var months = ['_','Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];

                return str.replace(/(\d+)\w+ of (\w+) (\d{4}).*/, function (_, d, m, y) {
                    return ('0' + d).substr(-2) + '-' + ('0' + months.indexOf(m.substr(0, 3))).substr(-2) + '-' + y;
                });
            }
        },

        skybet: {
            name: 'Sky Bet',
            getElements: function (callback) {
                function _getElements() {
                    var accountDoc = exports.document.getElementById('SkyBetAccount').contentDocument;
                    callback(accountDoc.querySelectorAll('li.transaction'));
                }

                if (SkySSO.sba.ui.isOpen) {
                    _getElements();
                }
                else {
                    SkySSO.sba.ui.open('https://www.skybet.com/secure/identity/m/history/betting/skybet?settled=Y', _getElements, true);
                }
            },

            getTransactionId: function (el) {
                return this._getData(el.querySelector('.bet-slip-footer'))['Bet receipt ID'].split('/')[2];
            },

            getTransactionDate: function (el) {
                return this._getDate(utils.text(el.querySelector('.bet-time-date')));
            },

            getStake: function (el) {
                var data = this._getData(el.querySelector('.bet-slip-footer'));

                return {
                    type: data['Bet type'],
                    stake: this._getAmount(data['Total stake']),
                    freebet: this._getAmount(data['Freebet used']),
                    returns: this._getAmount(data['Returns']),
                    refund:  this._getAmount(data['Refund']),
                };
            },

            getSelections: function (el) {
                return utils.map(el.querySelectorAll('.bet-selection'), function (row) {
                    var selectionData = utils.text(row.querySelector('.four-six h3')).split('@'),
                        selection     = selectionData[0].trim(),
                        event         = utils.text(row.querySelector('.four-six h3 + span')).split(/(?:\s+-\s+|\s{2,})/).filter(Boolean),
                        oddsNow       = row.querySelector('.bog-odds-now'),
                        data          = this._getData(row),
                        result        = (~utils.text(row.querySelector('.bet-status'), true).indexOf('won') ? 'Won' : 'Lost'),
                        resultText    = (data['Resulted'].split('-')[1] || '').trim(),
                        replacements  = {
                            ' (E/W)': /[\n\s]+EW$/,
                            ' - ':    /\s{2,}/g,
                            '-':      /[\u2010-\u2015]/g,
                            '':       / \(Was.*Now.*\)/i,
                        }, r;

                    for (r in replacements) {
                        selection = selection.replace(replacements[r], r);
                    }

                    if (resultText && (resultText == 'Void' || result == 'Won')) {
                        result = resultText; // e.g. "Placed 3"
                    }

                    return {
                        selection: selection,
                        event:     event[1].trim().replace(/([\d.:]+ [a-z]*):.*$/i, '$1'), // replaces horse race event details
                        market:    event[0].trim(),
                        date:      this._getDate(data['Event date']),
                        eachWay:   (data['EW terms'] ? data['EW terms'].match(/\(each way ([^)]+)\)/)[1] : false),
                        odds:      oddsNow ? utils.text(oddsNow) : (selectionData[1] || '').trim(),
                        result:    result.trim(),
                    };
                }, this);
            },

            _getData: function (el) {
                var data = [];

                utils.each(el.querySelectorAll('.hlist li'), function (detail) {
                    data[utils.text(detail.querySelector('.two-six')).replace(':', '')] = utils.text(detail.querySelector('.three-six'));
                });

                return data;
            },

            _getDate: function (str) {
                var months = ['_','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                return str.replace(/\d+:\d+ (\d+)\w+ (\w{3}) (\d{4}).*/, function (_, d, m, y) {
                    return ('0' + d).substr(-2) + '-' + ('0' + months.indexOf(m)).substr(-2) + '-' + y;
                });
            },

            _getAmount: function (str) {
                return +((str || '0.00').match(/\d+\.\d+/)[0] * 100).toFixed(0);
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
                console.info('Found', elements.length, 'transaction(s)');

                utils.each(elements, function (element) {
                    var data = app.getData(element);
                    console.debug('Data parsed:', data);
                    transactions.push(app.getTransaction(data));
                });

                callback(transactions);
            });
        },

        getDescription: function (data) {
            var description = '',
                eventSeparator = ' - ',
                selection,
                isAccumulator;

            if (/Single|Forecast/.test(data.stake.type)) {
                selection = data.selections[0] || {};
                description = (/Forecast/.test(data.stake.type) ? data.stake.type + ' (' + selection.selection + ')' : selection.selection);

                // types of market that shouldn't be included in the description
                // 365, 365, bv
                if (!~['Win', 'Win and Each Way', 'Win or E/W', 'Correct Score', 'Horse Racing Outright - Race'].indexOf(selection.market)) {
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

                description += '\n' + (selection.odds ? selection.odds + ' - ' : '') + selection.result;

                if (selection.result == 'Placed') {
                    // @todo bv, split out eachWay
                    description += ' (' + selection.eachWay + ')';
                }
            }
            else {
                description = data.stake.type;
                isAccumulator = data.selections.reduceRight(function (soFar, selection) {
                    return (soFar && (~['Full Time Result', 'Match Betting - 3 Way', 'Match Result', 'Draw No Bet'].indexOf(selection.market)));
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

                    text += ' - ' + (selection.odds ? selection.odds + ' - ' : '') + selection.result;
                    return text;
                }).join('\n');
            }

            if (data.stake.freebet) {
                description += '\n£' + (data.stake.freebet / 100).toFixed(2).replace('.00', '') + ' free bet used';
            }

            return description;
        },

        getData: function (element) {
            ['getTransactionId', 'getTransactionDate', 'getStake', 'getSelections'].forEach(function (method) {
                if (!this.handler[method]) {
                    throw new Error(this.name + ' handler must define ' + method + ' method');
                }
            }, this);

            return {
                id:         this.handler.getTransactionId(element),
                date:       this.handler.getTransactionDate(element),
                stake:      this.handler.getStake(element) || {},
                selections: this.handler.getSelections(element) || [],
            };
        },

        getTransaction: function (data) {
            var stake = data.stake;

            return {
                date:     data.date,
                amount:   (stake.returns + (stake.refund || 0) + (stake.freebet || 0) - stake.stake) || 0,
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
