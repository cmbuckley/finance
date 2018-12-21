const fs = require('fs');
const readline = require('readline');
const url = require('url');
const nonce = require('nonce')();

const configPath = __dirname + '/../../config/monzo.json';
const config = require(configPath);
const oauth = require('simple-oauth2').create(config.credentials);

function getAuthLink(options) {
    return new Promise(function (res, rej) {
        if (config.state && !options.forceLogin) {
            return res(config);
        }

        config.state = nonce();
        delete config.token;

        saveConfig(config).then(function () {
            console.log('Please visit the following link in your browser to authorise the application:\n');

            console.log(oauth.authorizationCode.authorizeURL({
                redirect_uri: config.redirectUri,
                state: config.state
            }) + '\n');

            res(config);
        }).catch(rej);
    });
}

function login(options) {
    return new Promise(function (res, rej) {
        if (config.token && !options.forceLogin) {
            const accessToken = oauth.accessToken.create(config.token);

            if (!accessToken.expired()) {
                return res(config);
            }

            console.error('Access token has expired, refreshing');
            return accessToken.refresh().then(function (newToken) {
                config.token = newToken.token;
                saveConfig(config).then(res, rej);
            });
        }

        getAuthLink(options).then(function () {
            question('Paste the URL from the "Log in to Monzo" button in the email: ').then(function (answer) {
                const authUrl = url.parse(answer, true);

                if (authUrl.query.state != config.state) {
                    return rej('State does not match requested state');
                }

                oauth.authorizationCode.getToken({
                    code: authUrl.query.code,
                    redirect_uri: config.redirectUri
                }).then(function (result) {
                    const accessToken = oauth.accessToken.create(result);
                    config.token = accessToken.token;
                    delete config.state;

                    saveConfig(config).then(res, rej);
                }).catch(rej);
            });
        }).catch(rej);
    });
}

function saveConfig(config) {
    return new Promise(function (res, rej) {
        fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8', function (err) {
            if (err) {
                return rej(err);
            }

            res(config);
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

module.exports = {login};
