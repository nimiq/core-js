// TODO in the long term merge this with Nimiq.Observable

class RemoteObservable {
    constructor(validEvents) {
        if (typeof(validEvents) === 'object') {
            validEvents = Object.values(validEvents);
        }
        this._validEvents = validEvents;
        this._listeners = {};
    }

    on(type, listener) {
        if (!this._isValidEvent(type)) {
            throw Error('Unsupported Event Type '+type);
        }
        if (!(type in this._listeners)) {
            this._listeners[type] = [];
        }
        this._listeners[type].push(listener);
    }


    off(type, listener) {
        if (!(type in this._listeners)) {
            return;
        }
        let index = this._listeners[type].indexOf(listener);
        if (index === -1) {
            return;
        }
        this._listeners[type].splice(index, 1);
    }



    fire(type, arg) {
        // notify listeners. Use setTimeout run the listener in a microtask after the current code has finished
        if (this._listeners[type]) {
            this._listeners[type].forEach(listener => setTimeout(() => listener(arg)));    
        }
        // Notify wildcard listeners. Pass event type as first argument
        if (this._listeners[RemoteObservable.WILDCARD]) {
            this._listeners[RemoteObservable.WILDCARD].forEach(listener => setTimeout(() => listener.apply(null, arguments)));
        }
    }


    _isValidEvent(type) {
        return type===RemoteObservable.WILDCARD || this._validEvents.indexOf(type) !== -1;
    }
}
RemoteObservable.WILDCARD = '*';
Class.register(RemoteObservable);