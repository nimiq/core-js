class Buffer extends Uint8Array {
    constructor(arg) {
        super(arg);
        this._position = 0;
    }

    read(length) {
        var value = this.subarray(this._position, length);
        this._position += length;
        return value;
    }
    write(array) {
        this.set(array, this._position);
        this._position += array.byteLength;
    }

    readUint8() {
        return this[this._position++];
    }
    writeUint8(value) {
        this[this._position++] = value;
    }

    readUint16() {
        const value = new Uint16Array(this, this._position, 1)[0];
        this._position += 2;
        return value;
    }
    writeUint16(value) {
        new Uint16Array(this, this._position, 1)[0] = value;
        this._position += 2;
    }

    readUint32() {
        const value = new Uint32Array(this, this._position, 1)[0];
        this._position += 4;
        return value;
    }
    writeUint32(value) {
        new Uint32Array(this, this._position, 1)[0] = value;
        this._position += 4;
    }

    readUint64() {
        const value = new Float64Array(this, this._position, 1)[0];
        this._position += 8;
        return value;
    }
    writeUint64(value) {
        new Float64Array(this, this._position, 1)[0] = value;
        this._position += 8;
    }
}
