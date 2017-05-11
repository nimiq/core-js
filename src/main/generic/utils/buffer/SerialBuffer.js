class SerialBuffer extends Uint8Array {
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
        if (value < 0 || value > this.byteLength) throw 'Invalid readPos ' + value;
        this._readPos = value;
    }

    get writePos() {
        return this._writePos;
    }
    set writePos(value) {
        if (value < 0 || value > this.byteLength) throw 'Invalid writePos ' + value;
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

    readFixLengthString(length) {
        const bytes = this.read(length);
        let i = 0;
        while (i < length && bytes[i] != 0x0) i++;
        const view = new Uint8Array(bytes.buffer, bytes.byteOffset, i);
        return BufferUtils.toAscii(view);
    }
    writeFixLengthString(value, length) {
        if (StringUtils.isMultibyte(value) || value.length > length) throw 'Malformed value/length';
        const bytes = BufferUtils.fromAscii(value);
        this.write(bytes);
        const padding = length - bytes.byteLength;
        this.write(new Uint8Array(padding));
    }

    readVarLengthString() {
        const length = this.readUint8();
        if (this._readPos + length > this.length) throw 'Malformed length';
        const bytes = this.read(length);
        return BufferUtils.toAscii(bytes);
    }
    writeVarLengthString(value) {
        if (StringUtils.isMultibyte(value) || !NumberUtils.isUint8(value.length)) throw 'Malformed value';
        const bytes = BufferUtils.fromAscii(value);
        this.writeUint8(bytes.byteLength);
        this.write(bytes);
    }
}
Class.register(SerialBuffer);
