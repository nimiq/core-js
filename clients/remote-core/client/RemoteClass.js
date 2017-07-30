class RemoteClass extends RemoteObservable {
    constructor(identifier, attributes, events, remoteConnection) {
        events = Object.values(events);
        events = events.concat(Object.values(RemoteClass.Events));
        super(events);
        this._events = events;
        this._identifier = identifier;
        this._attributes = attributes;
        this._registeredServerEvents = new Set();
        this._remoteConnection = remoteConnection;
        this._remoteConnection.on('message', message => this._handleEvents(message));
        if (this._remoteConnection.connected) {
            this._updateState();
        }
        // request the current state whenever the connection is (re)established
        this._remoteConnection.on(RemoteConnection.Events.CONNECTION_ESTABLISHED, () => this._updateState());
        this._initialized = false;
    }

    /** @async */
    _updateState() {
        return this._remoteConnection.request({
            command: 'get-state',
            type: this._identifier
        }, this._identifier)
        .then(state => {
            this._attributes.forEach(attribute => this[attribute] = state[attribute]);
            if (!this._initialized) {
                this._initialized = true;
                this.fire(RemoteClass.Events.INITIALIZED);
            }
            return state;
        });
    }

    _handleEvents(message) {
        const serverEvent = message.type;
        const clientEvent = this._removeNameSpace(serverEvent);
        if (this._events.indexOf(clientEvent)!==-1) {
            this.fire(clientEvent, message.data);
        }
    }

    on(type, callback, lazyRegister) {
        super.on(type, callback); // this also checks whether it is a valid event
        if (!lazyRegister) {
            this._registerListener(type);
        }
    }

    off(type, callback) {
        super.off(type, callback);
        this._unregisterListener(type);
    }

    _addNameSpace(eventName) {
        return this._identifier + '-' + eventName;
    }

    _removeNameSpace(eventName) {
        return eventName.substr(this._identifier.length + 1); // +1 for the hyphen
    }

    _registerListener(clientEvent) {
        if (clientEvent === RemoteClass.Events.INITIALIZED) {
            return; // nothing to register on the server
        }
        if (clientEvent === RemoteObservable.WILDCARD) {
            this._events.forEach(event => this._registerListener(event));
            return;
        }
        const serverEvent = this._addNameSpace(clientEvent);
        if (!this._registeredServerEvents.has(serverEvent)) {
            this._registeredServerEvents.add(serverEvent);
            this._remoteConnection.send({
                command: 'register-listener',
                type: serverEvent
            }, true);
        }
    }

    _unregisterListener(clientEvent) {
        const serverEvent = this._addNameSpace(clientEvent);
        if ((clientEvent in this._listeners) && this._listeners[clientEvent].length === 0 && this._registeredServerEvents.has(serverEvent)) {
            this._registeredServerEvents.delete(serverEvent);
            this._remoteConnection.send({
                command: 'unregister-listener',
                type: serverEvent
            }, true);
        }
    }

    /**
     * @protected
     * Serialize an object to base 64.
     * @param {*} serializable - An object that implements a serialize method.
     * @returns {string} - The base 64 representation.
     */
    _serializeToBase64(serializable) {
        return Nimiq.BufferUtils.toBase64(serializable.serialize());
    }
}
RemoteClass.Events = {
    INITIALIZED: 'initialized'
};
Class.register(RemoteClass);