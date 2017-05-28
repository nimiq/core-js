class Observable {
    static get WILDCARD() {
        return '*';
    }

    constructor() {
        this._listeners = {};
    }

    on(type, callback) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(callback);
    }

    fire() {
        if (!arguments.length) throw 'Observable.fire() needs type argument';

        // Notify listeners for this event type.
        const type = arguments[0];
        if (this._listeners[type]) {
            const args = Array.prototype.slice.call(arguments, 1);
            for (const listener of this._listeners[type]) {
                listener.apply(null, args);
            }
        }

        // Notify wildcard listeners. Pass event type as first argument
        if (this._listeners[Observable.WILDCARD]) {
            for (const listener of this._listeners[Observable.WILDCARD]) {
                listener.apply(null, arguments);
            }
        }
    }

    bubble() {
        if (arguments.length < 2) throw 'Observable.bubble() needs observable and at least 1 type argument';

        const observable = arguments[0];
        const types = Array.prototype.slice.call(arguments, 1);
        for (const type of types) {
            let callback;
            if (type == Observable.WILDCARD) {
                callback = function() {
                    this.fire.apply(this, arguments);
                };
            } else {
                callback = function() {
                    this.fire.apply(this, [type, ...arguments]);
                };
            }
            observable.on(type, callback.bind(this));
        }
    }
}
Class.register(Observable);
