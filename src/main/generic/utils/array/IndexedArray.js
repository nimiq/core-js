class IndexedArray {
    constructor(array, ignoreDuplicates) {
        this._array = array || new Array();
        this._ignoreDuplicates = ignoreDuplicates;

        this._index = new HashMap();
        this._buildIndex();

        return new Proxy(this._array, this);
    }

    _buildIndex() {
        for (let i = 0; i < this._array.length; ++i) {
            this._index.put(this._array[i], i);
        }
    }

    get(target, key) {
        if (typeof key == 'symbol') {
            return undefined;
        }

        // Forward index access (e.g. arr[5]) to underlying array.
        if (!isNaN(key)) {
            return target[key];
        }

        // Forward "public" properties of IndexedArray to 'this' (push(), pop() ...).
        if (this[key] && key[0] !== '_') {
            return this[key].bind ? this[key].bind(this) : this[key];
        }

        return undefined;
    }

    // TODO index access set, e.g. arr[5] = 42

    push(value) {
        if (this._index.contains(value)) {
            if (!this._ignoreDuplicates) throw 'IndexedArray.push() failed - value ' + value + ' already exists';
            return this._index.get(value);
        }

        const length = this._array.push(value);
        this._index.put(value, length - 1);
        return length;
    }

    pop() {
        const value = this._array.pop();
        this._index.remove(value);
        return value;
    }

    remove(value) {
        const index = this._index.get(value);
        if (index !== undefined) {
            delete this._array[this._index.get(value)];
            this._index.remove(value);
            return index;
        }
        return -1;
    }

    indexOf(value) {
        return this._index.get(value) >= 0 ? this._index.get(value) : -1;
    }

    isEmpty() {
        return this._index.length === 0;
    }

    slice(start, end) {
        const arr = this._array.slice(start, end);
        return new IndexedArray(arr, this._ignoreDuplicates);
    }

    get length() {
        return this._array.length;
    }

    get array() {
        return this._array;
    }
}
Class.register(IndexedArray);
