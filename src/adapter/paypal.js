const moment = require('moment'),
    axios = require('axios'),
    Adapter = require('../adapter'),
    Transaction = require('../transaction/paypal');

class PayPalAdapter extends Adapter {
    async getTransactions(from, to) {
        const client = axios.create({
                baseURL: this.getDefaultConfig().credentials.auth.tokenHost,
                headers: {
                    Authorization: 'Bearer ' + this.getAccessToken(),
                    'Content-Type': 'application/json',
                }
            });

        let transactions = [],
            start = from,
            end,
            response;

        do {
            end = moment.min(to, start.clone().add(30, 'days')),

            this.logger.verbose('Searching date range', {
                from: start.format('YYYY-MM-DD'),
                to: end.format('YYYY-MM-DD'),
            });

            try {
                response = await client.get('/v1/reporting/transactions', {
                    params: {
                        start_date: start.toISOString(),
                        end_date: end.toISOString(),
                        fields: ['transaction_info', 'cart_info', 'payer_info'].join(','),
                        page_size: 500,
                    },
                });
            } catch (err) {
                this.logger.debug('Request params', err.config.params);
                this.logger.debug(err.response.data);

                let message = err.response.data.message;
                if (err.response.data.details.length == 1) {
                    message = err.response.data.details[0].issue;
                }

                throw new Error(message);
            }

            if (!response.data.transaction_details) {
                throw new Error('No transactions found', {cause: response.data});
            }

            start = end.clone().add(1, 'days');

            transactions = transactions.concat(response.data.transaction_details.map(transaction => {
                this.logger.silly('Raw transaction', transaction);
                return new Transaction(this.config.name, transaction, this, this.logger);
            }));
        } while (end.isBefore(to, 'day'));

        this.logger.verbose(`Retrieved ${transactions.length} transactions`);
        return transactions;

    }

    getDefaultConfig() {
        return {
            grantType: 'client_credentials',
            credentials: {
                auth: {
                    tokenHost: 'https://api-m.paypal.com',
                    tokenPath: '/v1/oauth2/token',
                },
                options: {
                    scopeSeparator: ' ',
                }
            },
            scope: [
                'https://uri.paypal.com/services/reporting/search/read',
            ],
        };
    }
}

module.exports = PayPalAdapter;
