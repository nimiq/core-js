describe('BufferUtils', () => {
    if (PlatformUtils.isNodeJs()) btoa = require('btoa'); //eslint-disable-line no-global-assign

    it('has fromAscii and toAscii methods', () => {
        expect(BufferUtils.toAscii(BufferUtils.fromAscii('{x:"test"}'))).toEqual('{x:"test"}');
    });

    it('toAscii works with large buffers', () => {
        const size = 9827592;
        const arr = new Uint8Array(size);
        arr.fill(97);
        const str = 'a'.repeat(size);
        expect(BufferUtils.toAscii(arr)).toEqual(str);
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

    it('toBase64/fromBase64 handle all code points like btoa/atob', () => {
        const arr = [];
        for (let i = 0; i < 256; ++i) arr.push(i);
        const sb = new SerialBuffer(arr);
        const tobase64 = BufferUtils.toBase64(sb);
        const withbtoa = btoa(String.fromCharCode(...sb));

        expect(tobase64).toEqual(withbtoa);
        expect(BufferUtils.fromBase64(tobase64)).toEqual(sb);
        expect(BufferUtils.fromBase64(withbtoa)).toEqual(sb);
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

    it('toHex fulfills RFC 4648 test vectors', () => {
        expect(BufferUtils.toHex(BufferUtils.fromAscii(''))).toBe('');
        expect(BufferUtils.toHex(BufferUtils.fromAscii('f'))).toBe('66');
        expect(BufferUtils.toHex(BufferUtils.fromAscii('fo'))).toBe('666f');
        expect(BufferUtils.toHex(BufferUtils.fromAscii('foo'))).toBe('666f6f');
        expect(BufferUtils.toHex(BufferUtils.fromAscii('foob'))).toBe('666f6f62');
        expect(BufferUtils.toHex(BufferUtils.fromAscii('fooba'))).toBe('666f6f6261');
        expect(BufferUtils.toHex(BufferUtils.fromAscii('foobar'))).toBe('666f6f626172');
    });

    it('fromHex fulfills RFC 4648 test vectors', () => {
        expect(BufferUtils.toAscii(BufferUtils.fromHex(''))).toEqual('');
        expect(BufferUtils.toAscii(BufferUtils.fromHex('66'))).toEqual('f');
        expect(BufferUtils.toAscii(BufferUtils.fromHex('666f'))).toEqual('fo');
        expect(BufferUtils.toAscii(BufferUtils.fromHex('666f6f'))).toEqual('foo');
        expect(BufferUtils.toAscii(BufferUtils.fromHex('666f6f62'))).toEqual('foob');
        expect(BufferUtils.toAscii(BufferUtils.fromHex('666f6f6261'))).toEqual('fooba');
        expect(BufferUtils.toAscii(BufferUtils.fromHex('666f6f626172'))).toEqual('foobar');
    });

    it('correctly implements fromUtf8', () => {
        const vectors = [
            { str: '田中さんにあげて下さい', bytes: 'e794b0e4b8ade38195e38293e381abe38182e38192e381a6e4b88be38195e38184' },
            { str: '和製漢語', bytes: 'e5928ce8a3bde6bca2e8aa9e' },
            { str: 'ÅÍÎÏ˝ÓÔÒÚÆ☃', bytes: 'c385c38dc38ec38fcb9dc393c394efa3bfc392c39ac386e29883' },
            { str: 'ด้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็ ด้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็ ด้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็็้้้้้้้้็็็็็้้้้้็็็็', bytes: 'e0b894e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b98720e0b894e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b98720e0b894e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987e0b987e0b989e0b989e0b989e0b989e0b989e0b987e0b987e0b987e0b987' },
            { str: '❤️', bytes: 'e29da4efb88f' },
            { str: '﷽', bytes: 'efb7bd' },
            { str: ', معاملة بولندا، الإطلاق عل إيو', bytes: '2c20d985d8b9d8a7d985d984d8a920d8a8d988d984d986d8afd8a7d88c20d8a7d984d8a5d8b7d984d8a7d98220d8b9d98420d8a5d98ad988' },
            { str: 'Ṱ̺̺̕o͞ ̷i̲̬͇̪͙n̝̗͕v̟̜̘̦͟o̶̙̰̠kè͚̮̺̪̹̱̤ ̖t̝͕̳̣̻̪͞h̼͓̲̦̳̘̲e͇̣̰̦̬͎ ̢̼̻̱̘h͚͎͙̜̣̲ͅi̦̲̣̰̤v̻͍e̺̭̳̪̰-m̢iͅn̖̺̞̲̯̰d̵̼̟͙̩̼̘̳ ̞̥̱̳̭r̛̗̘e͙p͠r̼̞̻̭̗e̺̠̣͟s̘͇̳͍̝͉e͉̥̯̞̲͚̬͜ǹ̬͎͎̟̖͇̤t͍̬̤͓̼̭͘ͅi̪̱n͠g̴͉ ͏͉ͅc̬̟h͡a̫̻̯͘o̫̟̖͍̙̝͉s̗̦̲.̨̹͈̣', bytes: 'e1b9b0ccbaccbacc956fcd9e20ccb769ccb2ccaccd87ccaacd996ecc9dcc97cd9576cc9fcc9ccc98cca6cd9f6fccb6cc99ccb0cca06bc3a8cd9accaeccbaccaaccb9ccb1cca420cc9674cc9dcd95ccb3cca3ccbbccaacd9e68ccbccd93ccb2cca6ccb3cc98ccb265cd87cca3ccb0cca6ccaccd8e20cca2ccbcccbbccb1cc9868cd9acd8ecd99cc9ccca3ccb2cd8569cca6ccb2cca3ccb0cca476ccbbcd8d65ccbaccadccb3ccaaccb02d6dcca269cd856ecc96ccbacc9eccb2ccafccb064ccb5ccbccc9fcd99cca9ccbccc98ccb320cc9ecca5ccb1ccb3ccad72cc9bcc97cc9865cd9970cda072ccbccc9eccbbccadcc9765ccbacca0cca3cd9f73cc98cd87ccb3cd8dcc9dcd8965cd89cca5ccafcc9eccb2cd9accaccd9cc7b9ccaccd8ecd8ecc9fcc96cd87cca474cd8dccaccca4cd93ccbcccadcd98cd8569ccaaccb16ecda067ccb4cd8920cd8fcd89cd8563ccaccc9f68cda161ccabccbbccafcd986fccabcc9fcc96cd8dcc99cc9dcd8973cc97cca6ccb22ecca8ccb9cd88cca3' },
            { str: '表ポあA鷗ŒéＢ逍Üßªąñ丂㐀', bytes: 'e8a1a8e3839de3818241e9b797c592c3a9efbca2e9808dc39cc39fc2aac485c3b1e4b882e39080' },
            { str: '¯\\_(ツ)_/¯', bytes: 'c2af5c5f28e38384295f2fc2af' },
        ];

        for (const vector of vectors) {
            expect(BufferUtils.toHex(BufferUtils.fromUtf8(vector.str))).toBe(vector.bytes);
            expect(BufferUtils.toHex(BufferUtils._strToUint8Array(vector.str))).toBe(vector.bytes);
            if (typeof TextEncoder !== 'undefined') {
                expect(BufferUtils.toHex(BufferUtils._utf8TextEncoder(vector.str))).toBe(vector.bytes);
            }
        }
    });

    it('has an equals method', () => {
        const buffer1 = BufferUtils.fromAscii('test');
        const buffer2 = BufferUtils.fromAscii('test');
        const buffer3 = BufferUtils.fromAscii('test false');
        const buffer4 = new Uint16Array(buffer3.buffer);
        const buffer5 = BufferUtils.fromAscii('tess');
        const buffer6 = new Uint8Array([116, 101, 115, 115]);
        const buffer7 = BufferUtils.fromAscii('uest');
        const buffer8 = new Uint8Array(0);
        const buffer9 = BufferUtils.fromHex('e65e39616662f2c16d62dc08915e5a1d104619db8c2b9cf9b389f96c8dce9837');
        const buffer10 = BufferUtils.fromHex('e65e39616662f2c16d62dc08915e5a1d104619db9c2b9cf9b389f96c8dce9837');

        expect(BufferUtils.equals(buffer1, buffer2)).toEqual(true);
        expect(BufferUtils.equals(buffer1, buffer3)).toEqual(false);
        expect(BufferUtils.equals(buffer3, buffer1)).toEqual(false);
        expect(BufferUtils.equals(buffer3, buffer4)).toEqual(true);
        expect(BufferUtils.equals(buffer2, buffer5)).toEqual(false);
        expect(BufferUtils.equals(buffer5, buffer6)).toEqual(true);
        expect(BufferUtils.equals(buffer1, buffer6)).toEqual(false);
        expect(BufferUtils.equals(buffer1, buffer7)).toEqual(false);
        expect(BufferUtils.equals(buffer8, buffer8)).toEqual(true);
        expect(BufferUtils.equals(buffer8, buffer1)).toEqual(false);
        expect(BufferUtils.equals(buffer1, buffer8)).toEqual(false);
        expect(BufferUtils.equals(buffer9, buffer9)).toEqual(true);
        expect(BufferUtils.equals(buffer9, buffer10)).toEqual(false);
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
});
