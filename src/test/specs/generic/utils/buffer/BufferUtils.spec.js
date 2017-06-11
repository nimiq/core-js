describe('BufferUtils', () => {

    it('has fromUnicode and toUnicode methods', () => {
        expect(BufferUtils.toAscii(BufferUtils.fromAscii('{x:"test"}'))).toEqual('{x:"test"}');
    });

    it('has fromBase64 and toBase64 methods', () => {
        expect(BufferUtils.toBase64(BufferUtils.fromBase64('dGVzdA=='))).toEqual('dGVzdA==');
        // Also allow eqs to be missing in input
        expect(BufferUtils.toBase64(BufferUtils.fromBase64('dGVzdA'))).toEqual('dGVzdA==');
    });

    it('has fromBase64Url and toBase64Url methods', () => {
        expect(BufferUtils.toBase64Url(BufferUtils.fromBase64Url('A_-gaw..'))).toEqual('A_-gaw..');
        // Also allow dots to be missing in input
        expect(BufferUtils.toBase64Url(BufferUtils.fromBase64Url('A_-gaw'))).toEqual('A_-gaw..');
    });

    it('has an equals method', () => {
        const buffer1 = BufferUtils.fromAscii('test');
        const buffer2 = BufferUtils.fromAscii('test');
        const buffer3 = BufferUtils.fromAscii('test false');

        expect(BufferUtils.equals(buffer1, buffer2)).toEqual(true);
        expect(BufferUtils.equals(buffer1, buffer3)).toEqual(false);
    });


    it('can concat two buffers', () => {
        const buffer1 = BufferUtils.fromAscii('test1');
        const buffer2 = BufferUtils.fromAscii('test2');

        const concatedBuffer = BufferUtils.concatTypedArrays(buffer1, buffer2);
        const buffer3 = concatedBuffer.slice(0, buffer1.byteLength);
        const buffer4 = concatedBuffer.slice(buffer1.byteLength);

        expect(BufferUtils.equals(buffer1, buffer3)).toEqual(true);
        expect(BufferUtils.equals(buffer2, buffer4)).toEqual(true);
    });

    it('can build a buffer from hex', () => {
        const buffer1 = BufferUtils.fromHex('abcdef');
        const buffer2 = BufferUtils.fromHex('123456');

        const correctBuffer1 = new Uint8Array([171, 205, 239]);
        const correctBuffer2 = new Uint8Array([18, 52, 86]);

        expect(BufferUtils.equals(buffer1, correctBuffer1)).toEqual(true);
        expect(BufferUtils.equals(buffer2, correctBuffer2)).toEqual(true);
    });
});
