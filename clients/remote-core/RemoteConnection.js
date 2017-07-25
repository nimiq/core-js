/** 
 * A wrapper around WebSocket that supports connection reestablishment
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

    /**
     * Construct a new remote connection.
     * @param url - A websocket URL (protocol ws: or wss: for secure connections) */
    constructor(url) {
        super(RemoteConnection.EVENTS);
        this._url = url;
        this._ws = null;
        this._sendQueue = [];
        this._persistentMessages = []; // messages that should be resend when a new web socket gets opened
        window.addEventListener('online', () => this._setupWebSocket());
        if (navigator.onLine) {
            this._setupWebSocket();
        }
    }

    _setupWebSocket() {
        if (this._ws) return;
        this._ws = new WebSocket(this._url);
        this._ws.onopen = () => {
            // note that the messages do not neccessarily need to arrive in the same order at the server
            this._persistentMessages.forEach(message => this._ws.send(message));
            this._sendQueue.forEach(message => this._ws.send(message));
            this._sendQueue = [];
            this.fire(RemoteConnection.EVENTS.CONNECTION_ESTABLISHED);
        };
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
        this._ws.onmessage = event => {
            this.fire(RemoteConnection.EVENTS.MESSAGE, JSON.parse(event.data));
        };
    }

    isConnected() {
        return this._ws && this._ws.readyState === WebSocket.OPEN;
    }

    send(message, persistent) {
        message = JSON.stringify(message);
        if (persistent) {
            this._persistentMessages.push(message);
        }
        if (this.isConnected()) {
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
}
Class.register(RemoteConnection);