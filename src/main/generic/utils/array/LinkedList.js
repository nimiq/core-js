/**
 * @typedef {{next: ?LinkedListEntry, prev: ?LinkedListEntry, value: V|*}} LinkedListEntry
 */

/**
 * @template V
 * @implements {Iterable.<V>}
 */
class LinkedList {
    /**
     * @param {*} args
     */
    constructor(...args) {
        /** @type {number} */
        this._length = 0;
        /** @type {LinkedListEntry} */
        this._head = null;
        /** @type {LinkedListEntry} */
        this._tail = null;

        const values = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        for (const value of values) {
            this.push(value);
        }
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    push(value) {
        const entry = {
            next: null,
            prev: this._head,
            value: value
        };
        this._push(entry);
    }

    /**
     * @param {LinkedListEntry} entry
     * @returns {void}
     * @protected
     */
    _push(entry) {
        this._length++;

        if (!this._head) {
            this._head = entry;
            this._tail = entry;
            return;
        }

        this._head.next = entry;
        this._head = entry;
    }

    /**
     * @param {V|*} value
     */
    unshift(value) {
        const entry = {
            next: this._tail,
            prev: null,
            value: value
        };
        this._unshift(entry);
    }

    /**
     * @param {LinkedListEntry} entry
     * @returns {void}
     * @protected
     */
    _unshift(entry) {
        this._length++;

        if (!this._head) {
            this._head = entry;
            this._tail = entry;
            return;
        }

        this._tail.prev = entry;
        this._tail = entry;
    }

    /**
     * @returns {V|*}
     */
    pop() {
        if (!this._head) {
            return null;
        }

        this._length--;

        const entry = this._head;
        const prev = entry.prev;
        if (!prev) {
            this._head = null;
            this._tail = null;
            return entry.value;
        }

        prev.next = null;
        this._head = prev;
        return entry.value;
    }

    /**
     * @returns {V|*}
     */
    shift() {
        if (!this._head) {
            return null;
        }

        this._length--;

        const entry = this._tail;
        const next = entry.next;
        if (!next) {
            this._head = null;
            this._tail = null;
            return entry.value;
        }

        next.prev = null;
        this._tail = next;
        return entry.value;
    }

    /**
     * @param {LinkedListEntry} entry
     * @returns {void}
     * @protected
     */
    _remove(entry) {
        if (entry === this._head) {
            this.pop();
        } else if (entry === this._tail) {
            this.shift();
        } else {
            this._length--;
            entry.prev.next = entry.next;
            entry.next.prev = entry.prev;
        }
    }

    /**
     * @returns {void}
     */
    clear() {
        this._length = 0;
        this._head = null;
        this._tail = null;
    }

    /**
     * @returns {Iterator.<V|*>}
     */
    [Symbol.iterator]() {
        return this.iterator();
    }

    /**
     * @returns {Iterator.<V|*>}
     */
    *iterator() {
        let entry = this._tail;
        while (entry) {
            yield entry.value;
            entry = entry.next;
        }
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this._length === 0;
    }

    /** @type {V|*} */
    get first() {
        return this._tail ? this._tail.value : null;
    }

    /** @type {V|*} */
    get last() {
        return this._head ? this._head.value : null;
    }

    /** @type {number} */
    get length() {
        return this._length;
    }
}
Class.register(LinkedList);
