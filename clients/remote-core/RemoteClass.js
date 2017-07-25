class RemoteClass extends RemoteObservable {
    constructor(identifier, attributes, eventMap, remoteConnection) {
        super(eventMap);
        this._identifier = identifier;
        this._attributes = attributes;
        this._eventMap = eventMap || {};
        this._inverseEventMap = {};
        for (let key in this._eventMap) {
            this._inverseEventMap[this._eventMap[key]] = key;
        }
        this._registeredServerEvents = new Set();
        this._remoteConnection = remoteConnection;
        this._remoteConnection.on('message', message => this._handleEvents(message));
        if (this._remoteConnection.isConnected()) {
            this._updateState();
        }
        // request the current state whenever the connection is (re)established
        this._remoteConnection.on(RemoteConnection.EVENTS.CONNECTION_ESTABLISHED, () => this._updateState());
    }

    async _updateState() {
        return this._remoteConnection.request({
            command: 'get-state',
            type: this._identifier
        }, this._identifier)
        .then(state => {
            this._attributes.forEach(attribute => this[attribute] = state[attribute]);
            return state;
        });
    }

    _handleEvents(message) {
        if (message.type in this._eventMap) {
            this.fire(this._eventMap[message.type], message.data);
        }
    }

    on(type, callback, lazyRegister) {
        super.on(type, callback);
        const serverEvent = this._inverseEventMap[type] || type;
        if (!lazyRegister && !this._registeredServerEvents.has(serverEvent)) {
            this._registeredServerEvents.add(serverEvent);
            this._remoteConnection.send({
                command: 'register-listener',
                type: serverEvent
            }, true);
        }
    }

    off(type, callback) {
        super.off(type, callback);
        const serverEvent = this._inverseEventMap[type] || type;
        if ((type in this._listeners) && this._listeners[type].length === 0 && this._registeredServerEvents.has(serverEvent)) {
            this._registeredServerEvents.delete(serverEvent);
            this._remoteConnection.send({
                command: 'unregister-listener',
                type: serverEvent
            }, true);
        }
    }
}
Class.register(RemoteClass);