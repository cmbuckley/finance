const fs = require('fs');
const readline = require('readline');
const url = require('url');
const nonce = require('nonce')();
const Oauth = require('simple-oauth2');

class AuthClient {
    constructor(options) {
        this.configPath = options.configPath;
        this.config = require(options.configPath);
        this.oauth = Oauth.create(this.config.credentials);
    }

    getAuthLink(options) {
        let self = this;
        return new Promise(function (res, rej) {
            if (self.config.state && !options.forceLogin) {
                return res(self.config);
            }

            self.config.state = nonce();
            delete self.config.token;

            saveConfig(self).then(function () {
                console.log('Please visit the following link in your browser to authorise the application:\n');

                console.log(self.oauth.authorizationCode.authorizeURL({
                    redirect_uri: self.config.redirect_uri,
                    state: self.config.state,
                    scope: self.config.scope || '',
                }) + '\n');

                res(self.config);
            }).catch(rej);
        });
    }

    login(options) {
        let self = this;
        options = options || {};

        return new Promise(function (res, rej) {
            if (options.fakeLogin) {
                return res(self.config);
            }

            if (self.config.token && !options.forceLogin) {
                const accessToken = self.oauth.accessToken.create(self.config.token);

                if (!accessToken.expired() && !options.forceRefresh) {
                    return res(self.config);
                }

                console.error('Access token has expired, refreshing');
                return accessToken.refresh().then(function (newToken) {
                    self.config.token = newToken.token;
                    saveConfig(self).then(res, rej);
                }).catch(function (err) {
                    rej(err.data.payload);
                });
            }

            self.getAuthLink(options).then(function () {
                question('Paste the URL from the "Log in to Monzo" button in the email: ').then(function (answer) {
                    const authUrl = url.parse(answer, true);

                    if (authUrl.query.state != self.config.state) {
                        return rej('State does not match requested state');
                    }

                    self.oauth.authorizationCode.getToken({
                        code: authUrl.query.code,
                        redirect_uri: self.config.redirect_uri
                    }).then(function (result) {
                        const accessToken = self.oauth.accessToken.create(result);
                        self.config.token = accessToken.token;
                        delete self.config.state;

                        saveConfig(self).then(function () {
                            question('Hit enter when you have approved the login in the app: ').then(function () {
                                res(self.config);
                            }).catch(rej);
                        }).catch(rej);
                    }).catch(rej);
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
