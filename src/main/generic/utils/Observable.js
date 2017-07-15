class Observable {
    /**
     * @returns {string}
     * @constant
     */
    static get WILDCARD() {
        return '*';
    }

    constructor() {
        /** @type {Map.<string, Array.<Function>>} */
        this._listeners = new Map();
    }

    /**
     * @param {string} type
     * @param {Function} callback
     * @return {number}
     */
    on(type, callback) {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, [callback]);
            return 0;
        } else {
            return this._listeners.get(type).push(callback) - 1;
        }
    }

    /**
     * @param {string} type
     * @param {number} id
     */
    off(type, id) {
        if (!this._listeners.has(type) || !this._listeners.get(type)[id]) return;
        delete this._listeners.get(type)[id];
    }

    /**
     * @param {string} type
     * @param {...*} args
     */
    fire(type, ...args) {
        // Notify listeners for this event type.
        if (this._listeners.has(type)) {
            for (const listener of this._listeners.get(type)) {
                if (!listener) continue;
                listener.apply(null, args);
            }
        }

        // Notify wildcard listeners. Pass event type as first argument
        if (this._listeners.has(Observable.WILDCARD)) {
            for (const listener of this._listeners.get(Observable.WILDCARD)) {
                if (!listener) continue;
                listener.apply(null, arguments);
            }
        }
    }

    /**
     * @param {Observable} observable
     * @param {...string} types
     */
    bubble(observable, ...types) {
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
