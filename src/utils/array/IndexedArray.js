class IndexedArray {
    constructor(array) {
        this._array = array || new Array();
        this._index = {};

        this._buildIndex();

        return new Proxy(this._array, this);
    }

    _buildIndex() {
        for (let i = 0; i < this._array.length; ++i) {
            this._index[this._array[i]] = i;
        }
    }

    get(target, key) {
        // Forward index access (e.g. arr[5]) to underlying array.
        if (!isNaN(key)) {
            return target[key];
        }

        // Forward "public" properties of IndexedArray to 'this' (push(), pop() ...).
        if (this[key] && key[0] !== '_') {
            return this[key].bind ? this[key].bind(this) : this[key];
        }
    }

    push(value) {
        const length = this._array.push(value);
        if (this._index[value] !== undefined) throw 'IndexedArray.push() failed - value ' + value + ' already exists';
        this._index[value] = length - 1;
        return length;
    }

    pop() {
        const value = this._array.pop();
        delete this._index[value];
        return value;
    }

    indexOf(value) {
        return this._index[value] >= 0 ? this._index[value] : -1;
    }

    get length() {
        return this._array.length;
    }
}
