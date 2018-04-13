class UniqueLinkedList extends LinkedList {
    /**
     * @param {function(o: object): string} [fnHash]
     */
    constructor(fnHash) {
        super();
        this._map = new HashMap(fnHash);
    }

    /**
     * @param {V|*} value
     * @param {boolean} moveBack
     * @returns {void}
     * @override
     */
    push(value, moveBack = false) {
        const entry = this._map.get(value);
        if (!entry) {
            super.push(value);
        } else {
            entry.value = value;
            if (moveBack) {
                this._moveBack(entry);
            }
        }
    }

    /**
     * @param {LinkedListEntry} entry
     * @returns {void}
     * @protected
     * @override
     */
    _push(entry) {
        super._push(entry);
        this._map.put(entry.value, entry);
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    unshift(value) {
        if (!this._map.contains(value)) {
            super.unshift(value);
        }
    }

    /**
     * @param {LinkedListEntry} entry
     * @returns {void}
     * @protected
     */
    _unshift(entry) {
        super._unshift(entry);
        this._map.put(entry.value, entry);
    }

    /**
     * @returns {V|*}
     */
    pop() {
        const value = super.pop();
        this._map.remove(value);
        return value;
    }

    /**
     * @returns {V|*}
     */
    shift() {
        const value = super.shift();
        this._map.remove(value);
        return value;
    }

    /**
     * @returns {void}
     */
    clear() {
        super.clear();
        this._map.clear();
    }

    /**
     * @param {V|*} value
     * @returns {V|*}
     */
    get(value) {
        const entry = this._map.get(value);
        return entry && entry.value;
    }

    /**
     * @param {V|*} value
     * @returns {boolean}
     */
    contains(value) {
        return this._map.contains(value);
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    remove(value) {
        const entry = this._map.get(value);
        if (entry) {
            super._remove(entry);
            this._map.remove(value);
        }
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    moveBack(value) {
        /*
         * Just removing and inserting the key again may take seconds (yes, seconds!).
         * This is due to the JavaScript Map implementation as illustrated in this benchmark:
         * https://gist.github.com/paberr/1d916343631c0e42f8311a6f2782f30d
         *
         * 100,000 accesses using Map remove/insert: ~4s
         * 100,000 accesses using optimised version: ~9ms
         */
        const entry = this._map.get(value);
        if (entry) {
            this._moveBack(entry);
        } else {
            // Do not check again for presence in the map.
            super.push(value);
        }
    }

    /**
     * @param {LinkedListEntry} entry
     * @returns {void}
     * @protected
     */
    _moveBack(entry) {
        if (entry === this._head) {
            return;
        } else if (entry === this._tail) {
            entry.next.prev = null;
            this._tail = entry.next;
        } else {
            entry.prev.next = entry.next;
            entry.next.prev = entry.prev;
        }
        entry.next = null;
        entry.prev = this._head;
        this._head.next = entry;
        this._head = entry;
    }
}
Class.register(UniqueLinkedList);
