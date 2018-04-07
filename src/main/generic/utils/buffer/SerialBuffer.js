class SerialBuffer extends Uint8Array {
    /**
     * @param {*} bufferOrArrayOrLength
     */
    constructor(bufferOrArrayOrLength) {
        super(bufferOrArrayOrLength);
        this._view = new DataView(this.buffer);
        this._readPos = 0;
        this._writePos = 0;
    }

    /**
     * @param {number} start
     * @param {number} end
     * @return {Uint8Array}
     */
    subarray(start, end) {
        return ArrayUtils.subarray(this, start, end);
    }

    /** @type {number} */
    get readPos() {
        return this._readPos;
    }

    /** @type {number} */
    set readPos(value) {
        if (value < 0 || value > this.byteLength) throw `Invalid readPos ${value}`;
        this._readPos = value;
    }

    /** @type {number} */
    get writePos() {
        return this._writePos;
    }

    /** @type {number} */
    set writePos(value) {
        if (value < 0 || value > this.byteLength) throw `Invalid writePos ${value}`;
        this._writePos = value;
    }

    /**
     * Resets the read and write position of the buffer to zero.
     * @returns {void}
     */
    reset() {
        this._readPos = 0;
        this._writePos = 0;
    }

    /**
     * @param {number} length
     * @return {Uint8Array}
     */
    read(length) {
        const value = this.subarray(this._readPos, this._readPos + length);
        this._readPos += length;
        return new Uint8Array(value);
    }

    /**
     * @param {*} array
     */
    write(array) {
        this.set(array, this._writePos);
        this._writePos += array.byteLength;
    }

    /**
     * @return {number}
     */
    readUint8() {
        return this._view.getUint8(this._readPos++);
    }

    /**
     * @param {number} value
     */
    writeUint8(value) {
        this._view.setUint8(this._writePos++, value);
    }

    /**
     * @return {number}
     */
    readUint16() {
        const value = this._view.getUint16(this._readPos);
        this._readPos += 2;
        return value;
    }

    /**
     * @param {number} value
     */
    writeUint16(value) {
        this._view.setUint16(this._writePos, value);
        this._writePos += 2;
    }

    /**
     * @return {number}
     */
    readUint32() {
        const value = this._view.getUint32(this._readPos);
        this._readPos += 4;
        return value;
    }

    /**
     * @param {number} value
     */
    writeUint32(value) {
        this._view.setUint32(this._writePos, value);
        this._writePos += 4;
    }

    /**
     * @return {number}
     */
    readUint64() {
        const value = this._view.getUint32(this._readPos) * Math.pow(2, 32) + this._view.getUint32(this._readPos + 4);
        if (!NumberUtils.isUint64(value)) throw new Error('Malformed value');
        this._readPos += 8;
        return value;
    }

    /**
     * @param {number} value
     */
    writeUint64(value) {
        if (!NumberUtils.isUint64(value)) throw new Error('Malformed value');
        this._view.setUint32(this._writePos, Math.floor(value / Math.pow(2, 32)));
        this._view.setUint32(this._writePos + 4, value);
        this._writePos += 8;
    }

    /**
     * @return {number}
     */
    readVarUint() {
        const value = this.readUint8();
        if (value < 0xFD) {
            return value;
        } else if (value === 0xFD) {
            return this.readUint16();
        } else if (value === 0xFE) {
            return this.readUint32();
        } else /*if (value === 0xFF)*/ {
            return this.readUint64();
        }
    }

    /**
     * @param {number} value
     */
    writeVarUint(value) {
        if (!NumberUtils.isUint64(value)) throw new Error('Malformed value');
        if (value < 0xFD) {
            this.writeUint8(value);
        } else if (value <= 0xFFFF) {
            this.writeUint8(0xFD);
            this.writeUint16(value);
        } else if (value <= 0xFFFFFFFF) {
            this.writeUint8(0xFE);
            this.writeUint32(value);
        } else {
            this.writeUint8(0xFF);
            this.writeUint64(value);
        }
    }

    /**
     * @param {number} value
     * @returns {number}
     */
    static varUintSize(value) {
        if (!NumberUtils.isUint64(value)) throw new Error('Malformed value');
        if (value < 0xFD) {
            return 1;
        } else if (value <= 0xFFFF) {
            return 3;
        } else if (value <= 0xFFFFFFFF) {
            return 5;
        } else {
            return 9;
        }
    }

    /**
     * @return {number}
     */
    readFloat64() {
        const value = this._view.getFloat64(this._readPos);
        this._readPos += 8;
        return value;
    }

    /**
     * @param {number} value
     */
    writeFloat64(value) {
        this._view.setFloat64(this._writePos, value);
        this._writePos += 8;
    }

    /**
     * @param {number} length
     * @return {string}
     */
    readString(length) {
        const bytes = this.read(length);
        return BufferUtils.toAscii(bytes);
    }

    /**
     * @param {string} value
     * @param {number} length
     */
    writeString(value, length) {
        if (StringUtils.isMultibyte(value) || value.length !== length) throw 'Malformed value/length';
        const bytes = BufferUtils.fromAscii(value);
        this.write(bytes);
    }

    /**
     * @param {number} length
     * @return {string}
     */
    readPaddedString(length) {
        const bytes = this.read(length);
        let i = 0;
        while (i < length && bytes[i] !== 0x0) i++;
        const view = new Uint8Array(bytes.buffer, bytes.byteOffset, i);
        return BufferUtils.toAscii(view);
    }

    /**
     * @param {string} value
     * @param {number} length
     */
    writePaddedString(value, length) {
        if (StringUtils.isMultibyte(value) || value.length > length) throw 'Malformed value/length';
        const bytes = BufferUtils.fromAscii(value);
        this.write(bytes);
        const padding = length - bytes.byteLength;
        this.write(new Uint8Array(padding));
    }

    /**
     * @return {string}
     */
    readVarLengthString() {
        const length = this.readUint8();
        if (this._readPos + length > this.length) throw 'Malformed length';
        const bytes = this.read(length);
        return BufferUtils.toAscii(bytes);
    }

    /**
     * @param {string} value
     */
    writeVarLengthString(value) {
        if (StringUtils.isMultibyte(value) || !NumberUtils.isUint8(value.length)) throw new Error('Malformed value');
        const bytes = BufferUtils.fromAscii(value);
        this.writeUint8(bytes.byteLength);
        this.write(bytes);
    }

    /**
     * @param {string} value
     * @returns {number}
     */
    static varLengthStringSize(value) {
        if (StringUtils.isMultibyte(value) || !NumberUtils.isUint8(value.length)) throw new Error('Malformed value');
        return /*length*/ 1 + value.length;
    }
}
Class.register(SerialBuffer);
