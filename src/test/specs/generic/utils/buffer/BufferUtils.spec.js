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

    it('has fromBase32 and toBase32 methods', () => {
        expect(BufferUtils.toBase32(BufferUtils.fromBase32('MZXW6YQ=', BufferUtils.BASE32_ALPHABET.RFC4648), BufferUtils.BASE32_ALPHABET.RFC4648)).toEqual('MZXW6YQ=');
        // Also allow eqs to be missing in input
        expect(BufferUtils.toBase32(BufferUtils.fromBase32('MZXW6YQ', BufferUtils.BASE32_ALPHABET.RFC4648), BufferUtils.BASE32_ALPHABET.RFC4648)).toEqual('MZXW6YQ=');
    });

    it('toBase64 fulfills RFC 4648 test vectors', () => {
        expect(BufferUtils.toBase64(BufferUtils.fromAscii(''))).toBe('');
        expect(BufferUtils.toBase64(BufferUtils.fromAscii('f'))).toBe('Zg==');
        expect(BufferUtils.toBase64(BufferUtils.fromAscii('fo'))).toBe('Zm8=');
        expect(BufferUtils.toBase64(BufferUtils.fromAscii('foo'))).toBe('Zm9v');
        expect(BufferUtils.toBase64(BufferUtils.fromAscii('foob'))).toBe('Zm9vYg==');
        expect(BufferUtils.toBase64(BufferUtils.fromAscii('fooba'))).toBe('Zm9vYmE=');
        expect(BufferUtils.toBase64(BufferUtils.fromAscii('foobar'))).toBe('Zm9vYmFy');
    });

    it('fromBase64 fulfills RFC 4648 test vectors', () => {
        expect(BufferUtils.toAscii(BufferUtils.fromBase64(''))).toEqual('');
        expect(BufferUtils.toAscii(BufferUtils.fromBase64('Zg=='))).toEqual('f');
        expect(BufferUtils.toAscii(BufferUtils.fromBase64('Zm8='))).toEqual('fo');
        expect(BufferUtils.toAscii(BufferUtils.fromBase64('Zm9v'))).toEqual('foo');
        expect(BufferUtils.toAscii(BufferUtils.fromBase64('Zm9vYg=='))).toEqual('foob');
        expect(BufferUtils.toAscii(BufferUtils.fromBase64('Zm9vYmE='))).toEqual('fooba');
        expect(BufferUtils.toAscii(BufferUtils.fromBase64('Zm9vYmFy'))).toEqual('foobar');
    });
    
    it('toBase32 fulfills RFC 4648 test vectors', () => {
        expect(BufferUtils.toBase32(BufferUtils.fromAscii(''), BufferUtils.BASE32_ALPHABET.RFC4648)).toBe('');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('f'), BufferUtils.BASE32_ALPHABET.RFC4648)).toBe('MY======');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('fo'), BufferUtils.BASE32_ALPHABET.RFC4648)).toBe('MZXQ====');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('foo'), BufferUtils.BASE32_ALPHABET.RFC4648)).toBe('MZXW6===');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('foob'), BufferUtils.BASE32_ALPHABET.RFC4648)).toBe('MZXW6YQ=');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('fooba'), BufferUtils.BASE32_ALPHABET.RFC4648)).toBe('MZXW6YTB');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('foobar'), BufferUtils.BASE32_ALPHABET.RFC4648)).toBe('MZXW6YTBOI======');
    });

    it('fromBase32 fulfills RFC 4648 test vectors', () => {
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('', BufferUtils.BASE32_ALPHABET.RFC4648))).toEqual('');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('MY======', BufferUtils.BASE32_ALPHABET.RFC4648))).toEqual('f');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('MZXQ====', BufferUtils.BASE32_ALPHABET.RFC4648))).toEqual('fo');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('MZXW6===', BufferUtils.BASE32_ALPHABET.RFC4648))).toEqual('foo');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('MZXW6YQ=', BufferUtils.BASE32_ALPHABET.RFC4648))).toEqual('foob');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('MZXW6YTB', BufferUtils.BASE32_ALPHABET.RFC4648))).toEqual('fooba');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('MZXW6YTBOI======', BufferUtils.BASE32_ALPHABET.RFC4648))).toEqual('foobar');
    });

    it('toBase32 fulfills RFC 4648 hex test vectors', () => {
        expect(BufferUtils.toBase32(BufferUtils.fromAscii(''), BufferUtils.BASE32_ALPHABET.RFC4648_HEX)).toBe('');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('f'), BufferUtils.BASE32_ALPHABET.RFC4648_HEX)).toBe('CO======');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('fo'), BufferUtils.BASE32_ALPHABET.RFC4648_HEX)).toBe('CPNG====');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('foo'), BufferUtils.BASE32_ALPHABET.RFC4648_HEX)).toBe('CPNMU===');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('foob'), BufferUtils.BASE32_ALPHABET.RFC4648_HEX)).toBe('CPNMUOG=');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('fooba'), BufferUtils.BASE32_ALPHABET.RFC4648_HEX)).toBe('CPNMUOJ1');
        expect(BufferUtils.toBase32(BufferUtils.fromAscii('foobar'), BufferUtils.BASE32_ALPHABET.RFC4648_HEX)).toBe('CPNMUOJ1E8======');
    });

    it('fromBase32 fulfills RFC 4648 hex test vectors', () => {
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('', BufferUtils.BASE32_ALPHABET.RFC4648_HEX))).toEqual('');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('CO======', BufferUtils.BASE32_ALPHABET.RFC4648_HEX))).toEqual('f');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('CPNG====', BufferUtils.BASE32_ALPHABET.RFC4648_HEX))).toEqual('fo');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('CPNMU===', BufferUtils.BASE32_ALPHABET.RFC4648_HEX))).toEqual('foo');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('CPNMUOG=', BufferUtils.BASE32_ALPHABET.RFC4648_HEX))).toEqual('foob');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('CPNMUOJ1', BufferUtils.BASE32_ALPHABET.RFC4648_HEX))).toEqual('fooba');
        expect(BufferUtils.toAscii(BufferUtils.fromBase32('CPNMUOJ1E8======', BufferUtils.BASE32_ALPHABET.RFC4648_HEX))).toEqual('foobar');
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
