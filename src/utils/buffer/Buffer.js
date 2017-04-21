class Buffer extends Uint8Array {
    constructor(arg) {
        super(arg);
        this._readPos = 0;
        this._writePos = 0;
    }

    read(length) {
        var value = this.subarray(this._readPos, length);
        this._readPos += length;
        return value;
    }
    write(array) {
        this.set(array, this._writePos);
        this._writePos += array.byteLength;
    }

    readUint8() {
        return this[this._readPos++];
    }
    writeUint8(value) {
        this[this._writePos++] = value;
    }

    readUint16() {
        const value = new Uint16Array(this.buffer, this._readPos, 1)[0];
        this._readPos += 2;
        return value;
    }
    writeUint16(value) {
        new Uint16Array(this.buffer, this._writePos, 1)[0] = value;
        this._writePos += 2;
    }

    readUint32() {
        const value = new Uint32Array(this.buffer, this._readPos, 1)[0];
        this._readPos += 4;
        return value;
    }
    writeUint32(value) {
        new Uint32Array(this.buffer, this._writePos, 1)[0] = value;
        this._writePos += 4;
    }

    readUint64() {
        const value = new Float64Array(this.buffer, this._readPos, 1)[0];
        this._readPos += 8;
        return value;
    }
    writeUint64(value) {
        new Float64Array(this.buffer, this._writePos, 1)[0] = value;
        this._writePos += 8;
    }
}
