const fs = require('fs').promises,
    { once } = require('events'),
    http = require('http'),
    readline = require('readline'),
    url = require('url'),
    nonce = require('nonce')(),
    { AuthorizationCode, ClientCredentials } = require('simple-oauth2');

const grantTypes = {
    client_credentials: ClientCredentials,
    authorization_code: AuthorizationCode,
};

class AuthClient {
    constructor(configPath, adapterConfig, logger) {
        this.configPath = configPath;
        this.config = require(configPath);
        this.adapterConfig = adapterConfig;
        const Client = grantTypes[adapterConfig.grantType || 'authorization_code'];
        this.client = new Client(adapterConfig.credentials);
        this.logger = logger;
    }

    /**
     * Get URL to authorise application to bank
     *
     * @return string
     */
    async getAuthLink(options) {
        if (!this.config.state || options.forceLogin) {
            this.config.state = nonce();
            delete this.config.token;
            await this.saveConfig();
        }

        let params = {
            redirect_uri: this.adapterConfig.redirect_uri,
            state: this.config.state,
            scope: this.adapterConfig.scope || '',
        };

        // Truelayer supports multiple providers - force a specific selection
        if (this.adapterConfig.provider) {
            params.providers = this.adapterConfig.provider;

            // need to disable challenger banks if using an Open Banking provider, and vice versa
            let providerType = this.adapterConfig.provider.split('-')[1];
            params.disable_providers = 'uk-' + {ob: 'oauth', oauth: 'ob'}[providerType] + '-all';
        }

        return this.client.authorizeURL(params);
    }

    /**
     * Log in to the bank
     */
    async login(options) {
        let accessToken;
        options = options || {};

        if (this.config.token && !options.forceLogin) {
            accessToken = await this.client.createToken(this.config.token);

            if (!accessToken.expired() && !options.forceRefresh) {
                return this.config;
            }

            this.logger.verbose('Access token has expired, refreshing');

            try {
                let newToken = await accessToken.refresh();
                this.config.token = newToken.token;
                return await this.saveConfig();
            } catch (err) {
                this.logger.info('Refresh token has expired too, requesting new login');
            }
        }

        if (this.client instanceof ClientCredentials) {
            try {
                let token = await this.client.getToken({scope: this.config.scope});
                this.config.token = token.token;
                return await this.saveConfig();
            } catch (err) {
                this.logger.error(err.message);
                return this.config;
            }
        }

        this.logger.info('Please visit the following link in your browser to authorise the application:');
        this.logger.info(await this.getAuthLink(options));

        this.logger.info('Creating HTTP server for callback');
        this.server = http.createServer();

        this.server.listen(8000, () => {
            this.logger.verbose('HTTP server listening', {port: this.server.address().port});
        });

        const [request, response] = await once(this.server, 'request');
        return await this.oauthCallback(request, response);
    }

    /**
     * Close the callback server
     *
     * @param error Optional error to throw after closing
     */
    async closeServer(error) {
        await this.server.close();
        if (error) { throw error; }
    }

    /**
     * Handler for bank's callback
     *
     * @param request  HTTP request
     * @param reqponse HTTP response
     */
    async oauthCallback(request, response) {
        const authUrl = url.parse(request.url, true);
        let accessToken;

        this.logger.info('Received OAuth callback', authUrl.query);

        if (authUrl.query.state != this.config.state) {
            response.statusCode = 400;
            response.end('State does not match requested state');
            return await this.closeServer('State does not match requested state');
        }

        response.end('Thanks, you may close this window');
        this.logger.verbose('Closing HTTP server');

        if (authUrl.query.error) {
            return await this.closeServer(authUrl.query.error);
        }

        await this.closeServer();
        this.logger.verbose('Retrieving access token');

        accessToken = await this.client.getToken({
            code: authUrl.query.code,
            redirect_uri: this.adapterConfig.redirect_uri
        });

        this.config.token = accessToken.token;
        delete this.config.state;
        await this.saveConfig();

        if (this.adapterConfig.must_approve_token) {
            await question('Hit enter when you have approved the login in the app: ')
        }

        return this.config;
    }

    /**
     * Save config to file
     */
    async saveConfig() {
        await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
        return this.config;
    }
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
