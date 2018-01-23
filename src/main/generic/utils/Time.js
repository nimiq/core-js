/**
 * This class stores and provides the network time (current system
 * time with an offset calculated from our peer's time)
 */
class Time {
    /**
     * @constructor
     * @param {number} [offset=0]
     */
    constructor(offset = 0) {
        this._offset = offset;
    }

    /**
     * @param {number} offset
     */
    set offset(offset) {
        this._offset = offset;
    }

    /**
     * Returns the current time adjusted with the network's offset
     * @return {number}
     */
    now() {
        return Date.now() + this._offset;
    }
}
Class.register(Time);
