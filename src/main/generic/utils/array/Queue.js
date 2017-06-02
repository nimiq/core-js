class Queue {
    constructor(fnHash) {
        this._queue = [];
        this._fnHash = fnHash || Queue._hash;
    }

    static _hash(o) {
        return o.hashCode ? o.hashCode() : o.toString();
    }

    enqueue(value) {
        this._queue.push(value);
    }

    dequeue() {
        return this._queue.shift();
    }

    indexOf(value) {
        for (let i = 0; i <= this._queue.length; ++i) {
            if (this._fnHash(value) === this._fnHash(this._queue[i])) {
                return i;
            }
        }
        return -1;
    }

    remove(value) {
        const index = this.indexOf(value);
        if (index > -1) {
            this._queue.splice(index, 1);
        }
    }

    dequeueUntil(value) {
        const index = this.indexOf(value);
        if (index > -1) {
            return this._queue.splice(0, index + 1);
        }
        return [];
    }

    clear() {
        this._queue = [];
    }

    values() {
        return this._queue;
    }

    get length() {
        return this._queue.length;
    }
}
Class.register(Queue);
