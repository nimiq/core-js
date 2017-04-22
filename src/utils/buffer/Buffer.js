class Buffer extends Uint8Array {
    constructor(arg) {
        super(arg);
        this._view = new DataView(this.buffer);
        this._readPos = 0;
        this._writePos = 0;
    }

    get readPos() {
        return this._readPos;
    }
    set readPos(value) {
        if (value < 0 || value >= this.byteLength) throw 'Invalid argument';
        this._readPos = value;
    }

    get writePos() {
        return this._writePos;
    }
    set writePos(value) {
        if (value < 0 || value >= this.byteLength) throw 'Invalid argument';
        this._writePos = value;
    }
    
    read(length) {
        var value = this.subarray(this._readPos, this._readPos + length);
        this._readPos += length;
        return value;
    }
    write(array) {
        this.set(array, this._writePos);
        this._writePos += array.byteLength;
    }

    readUint8() {
        return this._view.getUint8(this._readPos++);
    }
    writeUint8(value) {
        this._view.setUint8(this._writePos++, value);
    }

    readUint16() {
        const value = this._view.getUint16(this._readPos);
        this._readPos += 2;
        return value;
    }
    writeUint16(value) {
        this._view.setUint16(this._writePos, value);
        this._writePos += 2;
    }

    readUint32() {
        const value = this._view.getUint32(this._readPos);
        this._readPos += 4;
        return value;
    }
    writeUint32(value) {
        this._view.setUint32(this._writePos, value);
        this._writePos += 4;
    }

    readUint64() {
        const value = this._view.getFloat64(this._readPos);
        this._readPos += 8;
        return value;
    }
    writeUint64(value) {
        this._view.setFloat64(this._writePos, value);
        this._writePos += 8;
    }

    readFixedString(length) {
        let bytes = this.read(length);
        let i;
        while (bytes[i] !== 0x0) i++;
        let view = new Uint8Array(bytes, 0, i);
        return BufferUtils.toUnicode(view);
    }
    writeFixedString(value, length) {
        var bytes = BufferUtils.fromUnicode(value);
        if (bytes.byteLength > length) throw 'Invalid argument';
        this.write(bytes);
        var padding = length - bytes.byteLength;
        this.write(new Uint8Array(padding));
    }
}
