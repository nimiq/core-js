const Nimiq = require('../../../dist/node.js');
const WebSocket = require('ws'); // https://github.com/websockets/ws
require('../shared/HashMessageAuthenticationCode.js'); // gets bound to the Nimiq object


class AuthenticatedConnection extends Nimiq.Observable {
    constructor(ws, authSecret) {
        super();
        this._ws = ws;
        this._authSecret = authSecret;
        this._authenticated = false;
        this._ws.on('message', message => this._onMessage(message));
        this._ws.on('close', () => this.fire(AuthenticatedConnection.Events.CONNECTION_CLOSED));
        this._ws.on('error', e => this.fire(AuthenticatedConnection.Events.CONNECTION_ERROR, e));
        if (this._ws.readyState === WebSocket.OPEN) {
            this._startAuthentication();
        } else {
            this._ws.on('open', () => this._startAuthentication());
        }
    }


    get authenticated() {
        return this._authenticated;
    }


    get connected() {
        return this.authenticated && this._ws.readyState === WebSocket.OPEN;
    }


    send(type, data) {
        if (this._ws.readyState === WebSocket.OPEN && (this.authenticated || type === AuthenticatedConnection.MessageTypes.ERROR
            || type === AuthenticatedConnection.MessageTypes.AUTHENTICATION_SERVER_CLIENT_CHALLENGE)) {
            // until the client is authenticated, only error messages and the challenge can be sent
            let message = {
                type: type
            };
            if (data !== undefined) {
                message.data = data;
            }
            this._ws.send(JSON.stringify(message));
        }
    }


    sendInfo(info) {
        this.send(AuthenticatedConnection.MessageTypes.INFO, info);
    }


    sendError(errorMessage, command) {
        errorMessage = 'Error' + (command? ' executing '+command : '') + ': ' +errorMessage;
        this.send(AuthenticatedConnection.MessageTypes.ERROR, errorMessage);
    }


    async _startAuthentication() {
        if (this.authenticated) {
            return;
        }
        this._serverChallenge = await this._generateChallenge();
        this._authTimeout = setTimeout(() => this._onAuthenticationTimeout(), AuthenticatedConnection.AUTHENTICATION_TIMEOUT);
        this.send(AuthenticatedConnection.MessageTypes.AUTHENTICATION_SERVER_CLIENT_CHALLENGE, this._serverChallenge);
    }


    _onAuthenticationTimeout() {
        this.sendError('Authentication Timeout.');
        this._closeConnection();
    }


    _closeConnection() {
        this._authenticated = false;
        this._serverChallenge = null;
        clearTimeout(this._authTimeout);
        this._authTimeout = null;
        this._ws.terminate();
        // A note about garbage collection: The WebSocket will be garbage collected as soon as the connection is closed
        // (https://www.w3.org/TR/2011/WD-websockets-20110419/#garbage-collection). If there is no other reference to
        // this AuthenticatedConnection instance than through the event listeners bound on the WebSocket, then this
        // instance will also be garbage collected at that time
    }


    _onMessage(message) {
        try {
            message = JSON.parse(message);
        } catch(e) {
            this.sendError('Message parse error: '+message);
            if (!this.authenticated) {
                // a not authenticated client send us an invalid message.
                this._closeConnection();
            }
            return;
        }
        if (this.authenticated) {
            this.fire(AuthenticatedConnection.Events.MESSAGE, message);
        } else {
            // handle authentication
            if (message.type === AuthenticatedConnection.MessageTypes.AUTHENTICATION_CLIENT_SERVER_RESPONSE) {
                this._handleAuthenticationClientServerResponse(message);
            } else {
                this.sendError('Not authenticated.');
                this._closeConnection();
            }
        }
    }


    async _generateChallenge() {
        return Nimiq.BufferUtils.toBase64((await Nimiq.PrivateKey.generate()).serialize()); // this private key is no sensitive data, we
        // just use it as a one time random challenge
    }


    async _handleAuthenticationClientServerResponse(message) {
        if (!message || typeof(message.hash)!=='string' || typeof(message.challenge)!=='string') {
            this.sendError('Authentication failed: Illegal response.');
            this._closeConnection();
            return;
        }
        const clientChallenge = message.challenge;
        // check the hash
        const clientServerHash = await Nimiq.HashMessageAuthenticationCode.hmac(
            await Nimiq.HashMessageAuthenticationCode.hmac(this._authSecret, clientChallenge), this._serverChallenge);
        if (clientServerHash.toBase64() === message.hash) {
            this._onAuthenticationSucces(clientChallenge);
        } else {
            this.sendError('Authentication failed: invalid hash');
            this._closeConnection();
        }
    }


    async _onAuthenticationSucces(clientChallenge) {
        this._authenticated = true;
        clearTimeout(this._authTimeout);
        this.fire(AuthenticatedConnection.Events.CONNECTION_ESTABLISHED);
        // answer the client challenge to also authenticate us to the client
        const serverClientHash = await Nimiq.HashMessageAuthenticationCode.hmac(
            await Nimiq.HashMessageAuthenticationCode.hmac(this._authSecret, this._serverChallenge), clientChallenge);
        this.send(AuthenticatedConnection.MessageTypes.AUTHENTICATION_SERVER_CLIENT_RESPONSE, serverClientHash.toBase64());
    }
}
AuthenticatedConnection.AUTHENTICATION_TIMEOUT = 30000; // 30 seconds
AuthenticatedConnection.Events = {
    MESSAGE: 'message',
    CONNECTION_ERROR: 'connection-error',
    CONNECTION_ESTABLISHED: 'connection-established',
    CONNECTION_CLOSED: 'connection-closed'
};
AuthenticatedConnection.MessageTypes = {
    AUTHENTICATION_SERVER_CLIENT_CHALLENGE: 'authentication-server-client-challenge',
    AUTHENTICATION_CLIENT_SERVER_RESPONSE: 'authentication-client-server-response',
    AUTHENTICATION_SERVER_CLIENT_RESPONSE: 'authentication-server-client-response',
    ERROR: 'error',
    INFO: 'info'
};

module.exports = AuthenticatedConnection;