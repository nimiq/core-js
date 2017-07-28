class RemoteClass extends RemoteObservable {
    constructor(identifier, attributes, events, remoteConnection) {
        events = Object.values(events);
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
    }

    /** @async */
    _updateState() {
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
        const serverEvent = message.type;
        const clientEvent = this._removeNameSpace(serverEvent);
        if (this._events.indexOf(clientEvent)!==-1) {
            this.fire(clientEvent, message.data);
        }
    }

    on(type, callback, lazyRegister) {
        const clientEvent = type;
        const serverEvent = this._addNameSpace(type);
        super.on(clientEvent, callback); // this also checks whether it is a valid event
        if (!lazyRegister && !this._registeredServerEvents.has(serverEvent)) {
            this._registeredServerEvents.add(serverEvent);
            this._remoteConnection.send({
                command: 'register-listener',
                type: serverEvent
            }, true);
        }
    }

    off(type, callback) {
        const clientEvent = type;
        const serverEvent = this._addNameSpace(type);
        super.off(clientEvent, callback);
        if ((clientEvent in this._listeners) && this._listeners[clientEvent].length === 0 && this._registeredServerEvents.has(serverEvent)) {
            this._registeredServerEvents.delete(serverEvent);
            this._remoteConnection.send({
                command: 'unregister-listener',
                type: serverEvent
            }, true);
        }
    }

    _addNameSpace(eventName) {
        return this._identifier + '-' + eventName;
    }

    _removeNameSpace(eventName) {
        return eventName.substr(this._identifier.length + 1); // +1 for the hyphen
    }
}
Class.register(RemoteClass);