describe('SerialBuffer', () => {

    it('can writeUint8 and readUint8', () => {

        const value1 = 255;
        const value2 = 254;
        const value3 = 0;
        const value4 = 1;

        const buffer = new SerialBuffer(4);
        buffer.writeUint8(value1);
        buffer.writeUint8(value2);
        buffer.writeUint8(value3);
        buffer.writeUint8(value4);

        expect(buffer.readUint8()).toEqual(value1);
        expect(buffer.readUint8()).toEqual(value2);
        expect(buffer.readUint8()).toEqual(value3);
        expect(buffer.readUint8()).toEqual(value4);

    });

    it('can writeUint16 and readUint16', () => {

        const value1 = 65535;
        const value2 = 2;
        const value3 = 65535;
        const value4 = 0;

        const buffer = new SerialBuffer(8);
        buffer.writeUint16(value1);
        buffer.writeUint16(value2);
        buffer.writeUint16(value3);
        buffer.writeUint16(value4);

        expect(buffer.readUint16()).toEqual(value1);
        expect(buffer.readUint16()).toEqual(value2);
        expect(buffer.readUint16()).toEqual(value3);
        expect(buffer.readUint16()).toEqual(value4);

    });

    it('can writeUint32 and readUint32', () => {

        const value1 = 4294967295;
        const value2 = 254;
        const value3 = 394967295;
        const value4 = 1;

        const buffer = new SerialBuffer(16);
        buffer.writeUint32(value1);
        buffer.writeUint32(value2);
        buffer.writeUint32(value3);
        buffer.writeUint32(value4);

        expect(buffer.readUint32()).toEqual(value1);
        expect(buffer.readUint32()).toEqual(value2);
        expect(buffer.readUint32()).toEqual(value3);
        expect(buffer.readUint32()).toEqual(value4);

    });

    it('can writeUint64 and readUint64', () => {

        const value1 = Number.MAX_SAFE_INTEGER;
        const value2 = 42;
        const value3 = Number.MAX_SAFE_INTEGER;
        const value4 = 1;
        const value5 = Math.pow(2, 34) - 1;
        const value6 = Math.pow(2, 34) + 1;
        const value7 = 0xFFFFFFFF * 0x10000 + 0xFFFF;

        const buffer = new SerialBuffer(56);
        buffer.writeUint64(value1);
        buffer.writeUint64(value2);
        buffer.writeUint64(value3);
        buffer.writeUint64(value4);
        buffer.writeUint64(value5);
        buffer.writeUint64(value6);
        buffer.writeUint64(value7);

        expect(buffer.readUint64()).toEqual(value1);
        expect(buffer.readUint64()).toEqual(value2);
        expect(buffer.readUint64()).toEqual(value3);
        expect(buffer.readUint64()).toEqual(value4);
        expect(buffer.readUint64()).toEqual(value5);
        expect(buffer.readUint64()).toEqual(value6);
        expect(buffer.readUint64()).toEqual(value7);

    });
    
    it('can writeVarUint and readVarUint', () => {
        const value1 = Number.MAX_SAFE_INTEGER;
        const value2 = 42;
        const value3 = Math.pow(2, 30);
        const value4 = 0;
        
        const buffer = new SerialBuffer(SerialBuffer.varUintSize(value1) + SerialBuffer.varUintSize(value2) + SerialBuffer.varUintSize(value3) + SerialBuffer.varUintSize(value4));
        buffer.writeVarUint(value1);
        buffer.writeVarUint(value2);
        buffer.writeVarUint(value3);
        buffer.writeVarUint(value4);

        expect(buffer.readVarUint()).toEqual(value1);
        expect(buffer.readVarUint()).toEqual(value2);
        expect(buffer.readVarUint()).toEqual(value3);
        expect(buffer.readVarUint()).toEqual(value4);
    });

    it('can writeUint16 and readUint16 unaligned', () => {

        const value1 = 65535;
        const value2 = 2;
        const value3 = 65535;
        const value4 = 0;

        const buffer = new SerialBuffer(9);
        buffer.writeUint8(0);
        buffer.writeUint16(value1);
        buffer.writeUint16(value2);
        buffer.writeUint16(value3);
        buffer.writeUint16(value4);

        buffer.readUint8();
        expect(buffer.readUint16()).toEqual(value1);
        expect(buffer.readUint16()).toEqual(value2);
        expect(buffer.readUint16()).toEqual(value3);
        expect(buffer.readUint16()).toEqual(value4);

    });

    it('can writeUint32 and readUint32 unaligned', () => {

        const value1 = 4294967295;
        const value2 = 254;
        const value3 = 394967295;
        const value4 = 1;

        const buffer = new SerialBuffer(17);
        buffer.writeUint8(0);
        buffer.writeUint32(value1);
        buffer.writeUint32(value2);
        buffer.writeUint32(value3);
        buffer.writeUint32(value4);

        buffer.readUint8();
        expect(buffer.readUint32()).toEqual(value1);
        expect(buffer.readUint32()).toEqual(value2);
        expect(buffer.readUint32()).toEqual(value3);
        expect(buffer.readUint32()).toEqual(value4);

    });

    it('can writeUint64 and readUint64 unaligned', () => {

        const value1 = Number.MAX_SAFE_INTEGER;
        const value2 = 42;
        const value3 = Number.MAX_SAFE_INTEGER;
        const value4 = 1;

        const buffer = new SerialBuffer(33);
        buffer.writeUint8(0);
        buffer.writeUint64(value1);
        buffer.writeUint64(value2);
        buffer.writeUint64(value3);
        buffer.writeUint64(value4);

        buffer.readUint8();
        expect(buffer.readUint64()).toEqual(value1);
        expect(buffer.readUint64()).toEqual(value2);
        expect(buffer.readUint64()).toEqual(value3);
        expect(buffer.readUint64()).toEqual(value4);

    });

    it('can read and write Uint8Arrays', () => {

        const length = 8;
        const array1 = new Uint8Array(length);

        const buffer = new SerialBuffer(length);
        buffer.write(array1);

        const array2 = buffer.read(length);

        expect(BufferUtils.equals(array1, array2)).toEqual(true);
    });

    it('can read and write fixed length Strings', () => {
        const string1 = 'this is a test';
        const length1 = string1.length;

        const string2 = 'this is another test';
        const length2 = string2.length;

        const buffer = new SerialBuffer(length1 + 1 + length2 + 2);
        buffer.writePaddedString(string1, length1 + 1);
        buffer.writePaddedString(string2, length2 + 2);

        const testString1 = buffer.readPaddedString(length1 + 1);
        expect(testString1.length).toBe(length1);
        expect(testString1).toBe(string1);

        const testString2 = buffer.readPaddedString(length2 + 2);
        expect(testString2.length).toBe(length2);
        expect(testString2).toBe(string2);

        expect(() => {
            buffer.writePaddedString(string1, length1 - 2);
        }).toThrow('Malformed value/length');
    });

    it('throws an error on invalid writes/reads', () => {
        const value1 = Number.MAX_SAFE_INTEGER;

        const buffer = new SerialBuffer(8);
        buffer.writeUint64(value1);

        buffer.readUint64();
        expect(() => {
            buffer.readUint64();
        }).toThrow();
    });
});
