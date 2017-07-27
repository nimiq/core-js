/** 
 * A wrapper around WebSocket that supports connection reestablishment and authentication
 */
class RemoteConnection extends RemoteObservable {
    static get EVENTS() {
        return {
            CONNECTION_ESTABLISHED: 'connection-established',
            CONNECTION_LOST: 'connection-lost',
            CONNECTION_ERROR: 'connection-error',
            MESSAGE: 'message'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            AUTHENTICATION_SERVER_CLIENT_CHALLENGE: 'authentication-server-client-challenge',
            AUTHENTICATION_CLIENT_SERVER_RESPONSE: 'authentication-client-server-response',
            AUTHENTICATION_SERVER_CLIENT_RESPONSE: 'authentication-server-client-response'
        };
    }
    static get AUTHENTICATION_STATUS() {
        return {
            WAITING_FOR_SERVER_CHALLENGE: 'waiting-for-server-challenge',
            WAITING_FOR_SERVER_RESPONSE: 'client-server-response-sent',
            AUTHENTICATED: 'authenticated'
        }
    }

    /**
     * Construct a new remote connection.
     * @param url - A websocket URL (protocol ws: or wss: for secure connections) */
    constructor(url, authenticationSecret) {
        super(RemoteConnection.EVENTS);
        this._url = url;
        this._authenticationSecret = authenticationSecret;
        this._ws = null;
        this._authenticationStatus = RemoteConnection.AUTHENTICATION_STATUS.WAITING_FOR_SERVER_CHALLENGE;
        this._sendQueue = [];
        this._persistentMessages = []; // messages that should be resend when a new web socket gets opened
        window.addEventListener('online', () => this._setupWebSocket());
        if (navigator.onLine) {
            this._setupWebSocket();
        }
    }

    _setupWebSocket() {
        if (this._ws) return;
        this._authenticationStatus = RemoteConnection.AUTHENTICATION_STATUS.WAITING_FOR_SERVER_CHALLENGE;
        this._clientChallenge = null;
        this._serverChallenge = null;
        this._ws = new WebSocket(this._url);
        this._ws.onclose = () => {
            // note that onclose also gets called in case that a connection couldn't be established
            this._ws = null;
            this.fire(RemoteConnection.EVENTS.CONNECTION_LOST);
            setTimeout(() => this._setupWebSocket(), 5000); // try to reconnect
        }
        this._ws.onerror = () => {
            // note that in the case of error the onclose also gets triggered
            this._ws = null;
            this.fire(RemoteConnection.EVENTS.CONNECTION_ERROR);
        };
        this._ws.onmessage = event => this._onMessage(event.data);
    }

    get authenticated() {
        return this._authenticationStatus === RemoteConnection.AUTHENTICATION_STATUS.AUTHENTICATED;
    }

    get webSocketOpen() {
        return this._ws && this._ws.readyState === WebSocket.OPEN;
    }

    get connected() {
        return this.webSocketOpen && this.authenticated;
    }

    send(message, persistent) {
        const type = message.type;
        message = JSON.stringify(message);
        if (persistent) {
            this._persistentMessages.push(message);
        }
        if (this.webSocketOpen
            && (this.authenticated || type === RemoteConnection.MESSAGE_TYPES.AUTHENTICATION_CLIENT_SERVER_RESPONSE)) {
            this._ws.send(message);
        } else if (!persistent) {
            // add it to the queue if it isn't persistent anyways
            this._sendQueue.push(message);
        }
    }

    /**
     * Request a data set (e.g. via get-state or accounts-get-balance) and resolve with the data when
     * the server send us he expected message.
     * @param request - A request message that will be send to the server
     * @param expectedMessage - either a string corresponding to the expected message type or a function that checks whether it accepts a message
     */
    async request(request, expectedMessage) {
        return new Promise((resolve, reject) => {
            this.send(request);
            const callback = message => {
                if ((typeof(expectedMessage)==='string' && message.type === expectedMessage)
                    || (typeof(expectedMessage)==='function' && expectedMessage(message))) {
                    this.off(RemoteConnection.EVENTS.MESSAGE, callback);
                    resolve(message.data);
                }
            };
            this.on(RemoteConnection.EVENTS.MESSAGE, callback);
        });
    }


    _onMessage(message) {
        message = JSON.parse(message);
        if (this.authenticated) {
            this.fire(RemoteConnection.EVENTS.MESSAGE, message);
        } else if (this._authenticationStatus === RemoteConnection.AUTHENTICATION_STATUS.WAITING_FOR_SERVER_CHALLENGE) {
            if (message.type === RemoteConnection.MESSAGE_TYPES.AUTHENTICATION_SERVER_CLIENT_CHALLENGE) {
                this._answerServerChallenge(message);
            } else {
                this.fire(RemoteConnection.EVENTS.CONNECTION_ERROR,
                    'Got wrong message from server while waiting for challenge: '+message.type+' - '+message.data);
                this._ws.close();
            }
        } else if (this._authenticationStatus === RemoteConnection.AUTHENTICATION_STATUS.WAITING_FOR_SERVER_RESPONSE) {
            if (message.type === RemoteConnection.MESSAGE_TYPES.AUTHENTICATION_SERVER_CLIENT_RESPONSE) {
                this._checkServerResponse(message);
            } else {
                this.fire(RemoteConnection.EVENTS.CONNECTION_ERROR,
                    'Got wrong message from server while waiting for response for challenge: '+message.type+' - '+message.data);
                this._ws.close();
            }
        }
    }


    async _answerServerChallenge(message) {
        // we got a challenge from the server. Answer with a hash and a challenge from us
        this._serverChallenge = message.data;
        this._clientChallenge = await this._generateChallenge();
        const clientServerHash = await Nimiq.HashMessageAuthenticationCode.hmac(
            await Nimiq.HashMessageAuthenticationCode.hmac(this._authenticationSecret, this._clientChallenge), this._serverChallenge);
        this.send({
            type: RemoteConnection.MESSAGE_TYPES.AUTHENTICATION_CLIENT_SERVER_RESPONSE,
            hash: clientServerHash.toBase64(),
            challenge: this._clientChallenge
        });
        this._authenticationStatus = RemoteConnection.AUTHENTICATION_STATUS.WAITING_FOR_SERVER_RESPONSE;
    }


    async _checkServerResponse(message) {
        const serverClientHash = await Nimiq.HashMessageAuthenticationCode.hmac(
            await Nimiq.HashMessageAuthenticationCode.hmac(this._authenticationSecret, this._serverChallenge), this._clientChallenge);
        if (serverClientHash.toBase64() === message.data) {
            // authentication successful
            this._authenticationStatus = RemoteConnection.AUTHENTICATION_STATUS.AUTHENTICATED;
            this._onAuthenticated();
        } else {
            this.fire(RemoteConnection.EVENTS.CONNECTION_ERROR, 'Authentication failed: Server sent wrong hash.');
            this._ws.close();
        }
    }


    _onAuthenticated() {
        // XXX note that the messages do not neccessarily need to arrive in the same order at the server
        this._persistentMessages.forEach(message => this._ws.send(message));
        this._sendQueue.forEach(message => this._ws.send(message));
        this._sendQueue = [];
        this.fire(RemoteConnection.EVENTS.CONNECTION_ESTABLISHED);
    }


    async _generateChallenge() {
        return Nimiq.BufferUtils.toBase64((await Nimiq.PrivateKey.generate()).serialize()); // this private key is no sensitive data, we
        // just use it as a one time random challenge
    }
}
Class.register(RemoteConnection);