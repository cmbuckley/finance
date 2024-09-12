const { EventEmitter } = require('events');
const assert = require('assert');
const sinon = require('sinon');

const AuthClient = require('../../src/lib/auth');
const fs = require('fs').promises;
const http = require('http');
const { AuthorizationCode } = require('simple-oauth2');

function setupConfig(config) {
    const origReadFile = fs.readFile;
    sinon.stub(fs, 'readFile').callsFake(origReadFile)
        .withArgs('fixtureconfig').resolves(JSON.stringify(config || {}));
}

describe('auth', () => {
    beforeEach(() => {
        this.logger = require('../util').logger();
        sinon.spy(this.logger, 'info');

        this.adapterConfig = {
            credentials: {
                client: {
                    id: 'ID',
                    secret: 'SECRET',
                },
                auth: {
                    tokenHost: 'https://thost',
                    tokenPath: '/token',
                    authorizeHost: 'https://ahost',
                    authorizePath: '/auth',
                },
            },
        };

        // http server for callbacks
        this.server = new EventEmitter;
        this.server.listen = sinon.spy();
        this.server.address = sinon.stub().returns({port: 3000});
        this.server.close = sinon.spy();
        sinon.stub(http, 'createServer').returns(this.server);

        this.writeStub = sinon.stub(fs, 'writeFile');
        this.configPath = 'fixtureconfig';
    });

    afterEach(sinon.restore);

    describe('with no previous state', () => {
        it('should log in successfully', (done) => {
            const token = {access_token: 'access token'};

            sinon.stub(AuthorizationCode.prototype, 'getToken').returns({token});
            const fixture = new AuthClient(this.configPath, this.adapterConfig, this.logger);
            setupConfig();

            // set up the final check once logged in
            fixture.login().then(() => {
                const savedConfig = JSON.parse(this.writeStub.secondCall.args[1]);
                assert.deepEqual(savedConfig.token, token);
                done();
            });

            setImmediate(() => {
                const responseStub = {end: sinon.spy()};

                // check we wrote the state for later
                assert(this.writeStub.callCount === 1);
                assert(this.writeStub.firstCall.args[0] == this.configPath);
                assert('state' in JSON.parse(this.writeStub.firstCall.args[1]));

                // check the server started
                assert(this.server.listen.callCount == 1);
                this.server.listen.firstCall.callback();

                // check we sent the URL to the logger/console
                assert(this.logger.info.calledWithMatch(/^https:\/\/ahost\/auth\?response_type=code&/));

                // mimic the OAuth callback
                this.server.emit('request', {
                    url: this.logger.info.secondCall.args[0], // this is the outbound url, but it has the state
                }, responseStub);

                setImmediate(() => {
                    assert(responseStub.end.calledWith('Thanks, you may close this window'));
                });
            });
        });
    });

    describe('with state set', () => {
        it('should not set a new state', async () => {
            const fixture = new AuthClient(this.configPath, this.adapterConfig, this.logger);
            fixture.config = {state: '123456789'};

            const url = await fixture.getAuthLink({});
            assert.match(url, /&state=123456789&/);
        });

        it('should set a new state when forceLogin is true', async () => {
            const fixture = new AuthClient(this.configPath, this.adapterConfig, this.logger);
            fixture.config = {state: '123456789'};

            const url = await fixture.getAuthLink({forceLogin: true});
            assert.match(url, /&state=[^&]+/);
            assert.doesNotMatch(url, /&state=123456789&/);
        });

        it('should error when the state does not match', async () => {
            const fixture = new AuthClient(this.configPath, this.adapterConfig, this.logger);
            fixture.config = {state: '123456789'};
            fixture.server = this.server;

            assert.rejects(async () => {
                const endSpy = sinon.spy();
                await fixture.oauthCallback({url: 'https://host?state=987654321'}, {end: endSpy});
                assert(endSpy.calledWith('State does not match requested state'));
            }, 'State does not match requested state');
        });
    });

    describe('With a valid token', () => {
        it('should log in successfully', async () => {
            // date in the future
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 7);

            const fixture = new AuthClient(this.configPath, this.adapterConfig, this.logger);
            setupConfig({token: {
                access_token: 'valid access token',
                expires_at: expiry.toISOString(),
            }});

            const config = await fixture.login();
            assert(this.writeStub.callCount == 0);
            assert.deepEqual(config, fixture.config);
        });

        // @todo new token when forceLogin
    });

    describe('With an expired access token', () => {
        it('should refresh the token', async () => {
            // date in the past
            const expiry = new Date();
            expiry.setDate(expiry.getDate() - 7);
            const newToken = {access_token: 'new token'};

            // fake expired token (rather than fake refresh API)
            sinon.stub(AuthorizationCode.prototype, 'createToken').returns({
                expired: sinon.stub().resolves(true),
                refresh: sinon.stub().resolves({token: newToken}),
            });

            const fixture = new AuthClient(this.configPath, this.adapterConfig, this.logger);
            setupConfig({token: {
                access_token: 'expired access token',
                expires_at: expiry.toISOString(),
            }});

            const config = await fixture.login();
            assert(this.writeStub.callCount == 1);
            assert.deepEqual(JSON.parse(this.writeStub.firstCall.args[1]).token, newToken);
            assert.deepEqual(config.token, newToken);
        });
    });

    describe('With an expired refresh token', () => {
        it('should require new login', (done) => {
            // fake expired tokens
            sinon.stub(AuthorizationCode.prototype, 'createToken').returns({
                expired: sinon.stub().resolves(true),
                refresh: sinon.stub().rejects('Refresh token expired'),
            });

            sinon.stub(AuthorizationCode.prototype, 'getToken').returns({token: {access_token: 'access token'}});
            const fixture = new AuthClient(this.configPath, this.adapterConfig, this.logger);
            setupConfig();

            fixture.login();

            setImmediate(() => {
                assert(this.server.listen.callCount == 1);

                // check we sent the URL, ignore the rest
                assert(this.logger.info.calledWithMatch(/^https:\/\/ahost\/auth\?response_type=code&/));
                done();
            });
        });
    });
});
