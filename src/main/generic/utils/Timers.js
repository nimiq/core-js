class Timers {
    constructor() {
        this._timeouts = Object.create(null);
        this._intervals = Object.create(null);
    }

    setTimeout(key, fn, waitTime) {
        if (this._timeouts[key]) throw new Error(`Duplicate timeout for key ${key}`);
        this._timeouts[key] = setTimeout(fn, waitTime);
    }

    clearTimeout(key) {
        clearTimeout(this._timeouts[key]);
        delete this._timeouts[key];
    }

    resetTimeout(key, fn, waitTime) {
        clearTimeout(this._timeouts[key]);
        this._timeouts[key] = setTimeout(fn, waitTime);
    }

    timeoutExists(key) {
        return this._timeouts[key] !== undefined;
    }

    setInterval(key, fn, intervalTime) {
        if (this._intervals[key]) throw new Error(`Duplicate interval for key ${key}`);
        this._intervals[key] = setInterval(fn, intervalTime);
    }

    clearInterval(key) {
        clearInterval(this._intervals[key]);
        delete this._intervals[key];
    }

    resetInterval(key, fn, intervalTime) {
        clearInterval(this._intervals[key]);
        this._intervals[key] = setInterval(fn, intervalTime);
    }

    intervalExists(key) {
        return this._intervals[key] !== undefined;
    }

    clearAll() {
        for (const key in this._timeouts) {
            this.clearTimeout(key);
        }
        for (const key in this._intervals) {
            this.clearInterval(key);
        }
    }
}
Class.register(Timers);
