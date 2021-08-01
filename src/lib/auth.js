const fs = require('fs'),
    http = require('http'),
    readline = require('readline'),
    url = require('url'),
    nonce = require('nonce')(),
    Oauth = require('simple-oauth2');

class AuthClient {
    constructor(configPath, adapterConfig, logger) {
        this.configPath = configPath;
        this.config = require(configPath);
        this.adapterConfig = adapterConfig;
        this.oauth = Oauth.create(adapterConfig.credentials);
        this.logger = logger;
    }

    getAuthLink(options) {
        let self = this;
        return new Promise(function (res, rej) {
            function done() {
                let params = {
                    redirect_uri: self.adapterConfig.redirect_uri,
                    state: self.config.state,
                    scope: self.adapterConfig.scope || '',
                };

                // Truelayer supports multiple providers - force a specific selection
                if (self.config.provider) {
                    params.providers = self.config.provider;
                    // need to disable challenger banks if using an Open Banking provider, and vice versa
                    params.disable_providers = 'uk-' + {ob: 'oauth', oauth: 'ob'}[self.config.provider.split('-')[1]] + '-all';
                }

                self.logger.info('Please visit the following link in your browser to authorise the application:');
                self.logger.info(self.oauth.authorizationCode.authorizeURL(params));

                res(self.config);
            }

            if (self.config.state && !options.forceLogin) {
                return done();
            }

            self.config.state = nonce();
            delete self.config.token;

            saveConfig(self).then(done).catch(rej);
        });
    }

    login(options) {
        let self = this;
        options = options || {};

        return new Promise(async function (resolve, rej) {
            if (self.config.token && !options.forceLogin) {
                const accessToken = self.oauth.accessToken.create(self.config.token);

                if (!accessToken.expired() && !options.forceRefresh) {
                    return resolve(self.config);
                }

                self.logger.info('Access token has expired, refreshing');

                try {
                    let newToken = await accessToken.refresh();
                    self.config.token = newToken.token;
                    return saveConfig(self).then(resolve, rej);
                } catch (err) {
                    self.logger.info('Refresh token has expired too, requesting new login');
                }
            }

            self.getAuthLink(options).then(function () {
                const server = http.createServer(function(req, response) {
                    const authUrl = url.parse(req.url, true);
                    self.logger.info('Received OAuth callback', authUrl.query);

                    // any errors before the server is closed
                    function closeAndError(err) {
                        server.close(() => rej(err));
                    }

                    if (authUrl.query.state != self.config.state) {
                        response.statusCode = 400;
                        response.end('State does not match requested state');
                        return closeAndError('State does not match requested state');
                    }

                    response.end('Thanks, you may close this window');
                    self.logger.verbose('Closing HTTP server');

                    if (authUrl.query.error) {
                        return closeAndError(authUrl.query.error);
                    }

                    server.close(() => {
                        self.logger.verbose('Retrieving access token');

                        self.oauth.authorizationCode.getToken({
                            code: authUrl.query.code,
                            redirect_uri: self.adapterConfig.redirect_uri
                        }).then(function (result) {
                            const accessToken = self.oauth.accessToken.create(result);
                            self.config.token = accessToken.token;
                            delete self.config.state;

                            saveConfig(self).then(function () {
                                function done() {
                                    resolve(self.config);
                                }

                                if (!self.adapterConfig.must_approve_token) { return done(); }
                                question('Hit enter when you have approved the login in the app: ').then(done).catch(rej);
                            }).catch(rej);
                        }).catch(rej);
                    });
                });

                self.logger.info('Creating HTTP server for callback');
                server.listen(8000, function () {
                    self.logger.verbose('HTTP server listening', {port: this.address().port});
                });
            }).catch(rej);
        });
    }
}

function saveConfig(auth) {
    return new Promise(function (res, rej) {
        fs.writeFile(auth.configPath, JSON.stringify(auth.config, null, 2), 'utf-8', function (err) {
            if (err) {
                return rej(err);
            }

            res(auth.config);
        });
    });
}

function question(query) {
    const rl = readline.createInterface({
        input:  process.stdin,
        output: process.stdout
    });

    return new Promise(function (res, rej) {
        return rl.question(query, function (answer) {
            rl.close();
            res(answer);
        });
    });
}

module.exports = AuthClient;
