class Observable {
    constructor() {
        this._listeners = {};
    }

    on(type, callback) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners.push(callback);
    }

    fire(type, obj) {
        if (this._listeners[type]) {
            for (let listener of this._listeners[type]) {
                listener(obj);
            }
        }
    }
}
