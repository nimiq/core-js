class Observable {
    constructor() {
        this._listeners = {};
    }

    on(type, callback) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(callback);
    }

    fire() {
        if (!arguments.length) throw 'Obserable.fire() needs type argument';
        const type = arguments[0];
        if (this._listeners[type]) {
            const args = arguments.slice(1);
            for (let listener of this._listeners[type]) {
                listener.apply(null, args);
            }
        }
    }
}
