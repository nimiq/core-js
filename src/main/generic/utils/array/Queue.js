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

    enqueueFirst(value) {
        this._queue.unshift(value);
    }

    enqueueUnique(value) {
        if (this.indexOf(value) >= 0) return;
        this.enqueue(value);
    }

    enqueueAllNew(values) {
        for (const value of values) this.enqueueUnique(value);
    }

    dequeue() {
        return this._queue.shift();
    }

    peek() {
        return this._queue[0];
    }

    /**
     * @param {*} value
     * @return {number}
     */
    indexOf(value) {
        const hash = this._fnHash(value);
        for (let i = 0; i < this._queue.length; ++i) {
            if (hash === this._fnHash(this._queue[i])) {
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

    /**
     * @param {number} count
     * @return {Array}
     */
    dequeueMulti(count) {
        return this._queue.splice(0, count);
    }

    /**
     * @param {*} value
     * @return {Array}
     */
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

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this.length === 0;
    }

    /** @type {number} */
    get length() {
        return this._queue.length;
    }
}
Class.register(Queue);
