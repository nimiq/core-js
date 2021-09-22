class SortedList {
    constructor(sortedList = [], compare) {
        this._list = sortedList;
        this._compare = compare || SortedList._compare;
    }

    static _compare(a, b) {
        return a.compare ? a.compare(b) : (a > b ? 1 : (a < b ? -1 : 0));
    }

    indexOf(o) {
        let a = 0, b = this._list.length - 1;
        let currentIndex = null;
        let currentElement = null;

        while (a <= b) {
            currentIndex = Math.floor((a + b) / 2);
            currentElement = this._list[currentIndex];

            if (this._compare(currentElement, o) < 0) {
                a = currentIndex + 1;
            }
            else if (this._compare(currentElement, o) > 0) {
                b = currentIndex - 1;
            }
            else {
                // Might not be the first occurence though!
                // Iterate back to find first.
                while (currentIndex > 0 && this._compare(this._list[currentIndex - 1], o) == 0) {
                    currentIndex--;
                }
                return currentIndex;
            }
        }

        return -1;
    }

    _insertionIndex(o) {
        let a = 0, b = this._list.length - 1;
        let currentIndex = null;
        let currentElement = null;

        while (a <= b) {
            currentIndex = Math.floor((a + b) / 2);
            currentElement = this._list[currentIndex];

            if (this._compare(currentElement, o) < 0) {
                a = currentIndex + 1;
            }
            else if (this._compare(currentElement, o) > 0) {
                b = currentIndex - 1;
            }
            else {
                return currentIndex;
            }
        }

        return b + 1;
    }

    add(value) {
        this._list.splice(this._insertionIndex(value), 0, value);
    }

    shift() {
        return this._list.shift();
    }

    pop() {
        return this._list.pop();
    }

    peekFirst() {
        return this._list[0];
    }

    peekLast() {
        return this._list[this._list.length - 1];
    }

    remove(value) {
        const index = this.indexOf(value);
        if (index > -1) {
            this._list.splice(index, 1);
        }
    }

    clear() {
        this._list = [];
    }

    values() {
        return this._list;
    }

    /**
     * @returns {Iterator.<V|*>}
     */
    [Symbol.iterator]() {
        return this._list[Symbol.iterator]();
    }

    copy() {
        return new SortedList(this._list.slice(), this._compare);
    }

    /** @type {number} */
    get length() {
        return this._list.length;
    }
}
Class.register(SortedList);
