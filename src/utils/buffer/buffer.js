class Buffer {
    constructor(arg) {
        if (typeof arg === 'Uint8Array') {
            this._buffer = arg;
        }
        else if (typeof arg === 'ArrayBuffer'
                || typeof arg === 'Number') {
            this._buffer = new Uint8Array(arg);
        }
        else {
            throw 'Invalid argument';
        }
        this._position = 0;
    }

    read(length) {
        var value = this._buffer.subarray(this._position, length);
        this._position += length;
        return value;
    }
    write(array) {
        this.set(array, this._position);
        this._position += array.byteLength;
    }

    readUint16() {
        const value = new Uint16Array(this._buffer, this._position, 1)[0];
        this._position += 2;
        return value;
    }
    writeUint16(value) {
        new Uint16Array(this._buffer, this._position, 1)[0] = value;
        this._position += 2;
    }

    readUint32() {
        const value = new Uint32Array(this._buffer, this._position, 1)[0];
        this._position += 4;
        return value;
    }
    writeUint32(value) {
        new Uint32Array(this._buffer, this._position, 1)[0] = value;
        this._position += 4;
    }

    readUint64() {
        const value = new Float64Array(this._buffer, this._position, 1)[0];
        this._position += 8;
        return value;
    }
    writeUint64(value) {
        new Float64Array(this._buffer, this._position, 1)[0] = value;
        this._position += 8;
    }
}
