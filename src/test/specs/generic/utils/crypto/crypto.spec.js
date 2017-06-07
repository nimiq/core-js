describe('Crypto', () => {

    it('can create keys of proposed size', (done) => {
        (async function () {
            const keyPair = await Crypto.keyPairGenerate();
            expect(Crypto.publicKeySerialize(Crypto.keyPairPublic(keyPair)).byteLength).toEqual(Crypto.publicKeySize);
            expect(Crypto.privateKeySerialize(Crypto.keyPairPrivate(keyPair)).byteLength).toEqual(Crypto.privateKeySize);
            done();
        })();
    });

    it('can serialize, unserialize keys and use them afterwards', (done) => {
        (async function () {
            const keyPair = await Crypto.keyPairGenerate();
            const data = new Uint8Array([1, 2, 3]);
            const data2 = new Uint8Array([1, 2, 4]);
            const privateSerialized = Crypto.privateKeySerialize(Crypto.keyPairPrivate(keyPair));
            const publicSerialized = Crypto.publicKeySerialize(Crypto.keyPairPublic(keyPair));
            const sign = await Crypto.signatureCreate(Crypto.keyPairPrivate(keyPair), data);
            const verify = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), data, sign);
            const falsify = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), data2, sign);

            const privateUnserialized = Crypto.privateKeyUnserialize(privateSerialized);
            const publicUnserialized = Crypto.publicKeyUnserialize(publicSerialized);

            const verify2 = await Crypto.signatureVerify(publicUnserialized, data, sign);
            expect(verify2).toBe(verify);

            const falsify2 = await Crypto.signatureVerify(publicUnserialized, data2, sign);
            expect(falsify2).toBe(falsify);

            const sign2 = await Crypto.signatureCreate(privateUnserialized, data);
            expect(sign2.length).toBe(sign.length);

            done();
        })();
    });

    it('can derive a functional key pair from private key', (done) => {
        (async function () {
            const keyPair = await Crypto.keyPairGenerate();
            const data = new Uint8Array([1, 2, 3]);
            const keyPair2 = Crypto.keyPairDerive(Crypto.keyPairPrivate(keyPair));

            try {
                const sign = await Crypto.signatureCreate(Crypto.keyPairPrivate(keyPair), data);
                const verify = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), data, sign);
                expect(verify).toBe(true, 'can verify original with original key');
                const verify2 = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair2), data, sign);
                expect(verify2).toBe(true, 'can verify original with derived key');

                const sign2 = await Crypto.signatureCreate(Crypto.keyPairPrivate(keyPair2), data);
                const verify3 = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), data, sign2);
                expect(verify3).toBe(true, 'can verify derived with original key');
                const verify4 = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair2), data, sign2);
                expect(verify4).toBe(true, 'can verify derived with derived key');
            } catch (e) {
                console.log(e);
                expect(false).toBeTruthy();
            }

            done();
        })();
    });

    it('can verify RFC 6979 test vectors', (done) => {
        function deHex(str) {
            let a = [];
            for (let i = 0; i < str.length; i += 2) {
                a.push('0x' + str.substr(i, 2));
            }
            return a;
        }

        function deString(string) {
            var buf = new Array(string.length);
            for (let i = 0; i < string.length; ++i) {
                buf[i] = string.charCodeAt(i);
            }
            return buf;
        }

        (async function () {
            const x = deHex('C9AFA9D845BA75166B5C215767B1D6934E50C3DB36E89B127B8A622B120F6721');
            const Ux = deHex('60FED4BA255A9D31C961EB74C6356D68C049B8923B61FA6CE669622E60F29FB6');
            const Uy = deHex('7903FE1008B8BC99A41AE9E95628BC64F2F1B20C2D7E9F5177A3C294D4462299');

            const pub = Crypto.publicKeyUnserialize(new SerialBuffer(Ux.concat(Uy)));
            const priv = Crypto.privateKeyUnserialize(new SerialBuffer(x.concat(Ux).concat(Uy)));
            const pair = Crypto.keyPairDerive(priv);
            expect(BufferUtils.equals(Crypto.publicKeySerialize(Crypto.keyPairPublic(pair)), new SerialBuffer(Ux.concat(Uy)))).toBe(true, 'derived public key equals original');

            async function test(message, k, r, s) {
                const msg = new SerialBuffer(message);
                expect(await Crypto.signatureVerify(pub, msg, new Uint8Array(r.concat(s)))).toBe(true, 'verify given signature');
                expect(await Crypto.signatureVerify(pub, msg, await Crypto.signatureCreate(priv, msg))).toBe(true, 'verify created signature');
                expect(await Crypto.signatureVerify(Crypto.keyPairPublic(pair), msg, new Uint8Array(r.concat(s)))).toBe(true, 'verify given signature with derived key');
            }

            {
                const message = deString('sample');
                const k = deHex('A6E3C57DD01ABE90086538398355DD4C3B17AA873382B0F24D6129493D8AAD60');
                const r = deHex('EFD48B2AACB6A8FD1140DD9CD45E81D69D2C877B56AAF991C34D0EA84EAF3716');
                const s = deHex('F7CB1C942D657C41D436C7A1B6E29F65F3E900DBB9AFF4064DC4AB2F843ACDA8');
                await test(message, k, r, s);
            }

            {
                const message = deString('test');
                const k = deHex('D16B6AE827F17175E040871A1C7EC3500192C4C92677336EC2537ACAEE0008E0');
                const r = deHex('F1ABB023518351CD71D881567B1EA663ED3EFCF6C5132B354F28D3B0B7D38367');
                const s = deHex('019F4113742A2B14BD25926B49C649155F267E60D3814B4C0CC84250E46F0083');
                await test(message, k, r, s);
            }

            done();
        })();
    });

    it('can verify custom signature set', (done) => {
        (async function () {
            const testData = [
                [
                    'AKUtQ703A1Ib720Te5zceQWmNrDCLO5DED+Jyokz3V7YJ3bcOM5JQjMKIiB6iXFdCkt3SexZ1d608ZjPVAS3CA==',
                    'dhehnNDmZnPFv+QkbNQNBtGPrO0CvuKAYUE2ByfIx6+dHI9v0rRgEQqhpKjSrxqIusaJvCT5sTnbL0FIyH3p1g==',
                    'AAF2F6Gc0OZmc8W/5CRs1A0G0Y+s7QK+4oBhQTYHJ8jHr50cj2/StGARCqGkqNKvGoi6xom8JPmxOdsvQUjIfenWztto/gO1+//6q+jM1LHWoTl4BL1Br1HZegAAAEGfUdl4AAAAAAAAAg=='
                ],
                [
                    'J+6tURZ7cnkOvIEj2d0lWoCn1D6yLIO9eXWpsgDURdJxXIRl27wgSsBcLxqNkdzyEOuAa2lMVnm229YGJ9b9Yg==',
                    'UCcJnHMAKL3oovwLVzrimvAElh5YHi07RQLO4ZXCxdIbEvjxV0ilfWBcq9BObQGyTLhbt04/SaDl2j4XC1mSHg==',
                    'AAEAUCcJnHMAKL3oovwLVzrimvAElh5YHi07RQLO4ZXCxdIbEvjxV0ilfWBcq9BObQGyTLhbt04/SaDl2j4XC1mSHouh62k1wVYQkY9TFDgqnJiuvP7nQfKgXyAAAAAAAAAAAAAAAAAAAAE='
                ]
            ];

            for (const entry of testData) {
                expect(await Crypto.signatureVerify(Crypto.publicKeyUnserialize(BufferUtils.fromBase64(entry[1])), BufferUtils.fromBase64(entry[2]), Crypto.signatureUnserialize(BufferUtils.fromBase64(entry[0])))).toBeTruthy();
            }
            done();
        })();
    });

    it('can sign and verify data', (done) => {
        // http://www.ietf.org/rfc/rfc6090.txt
        (async function () {
            const dataToSign = BufferUtils.fromAscii('test data to sign');
            const keyPair = await Crypto.keyPairGenerate();
            const signature = await Crypto.signatureCreate(Crypto.keyPairPrivate(keyPair), dataToSign);
            const proof = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), dataToSign, signature);
            expect(proof).toEqual(true);
            done();
        })();
    });

    it('can verify serialized signature', (done) => {
        (async function () {
            const dataToSign = BufferUtils.fromAscii('test data to sign');
            const keyPair = await Crypto.keyPairGenerate();
            const signature = await Crypto.signatureCreate(Crypto.keyPairPrivate(keyPair), dataToSign);
            const proof = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), dataToSign, Crypto.signatureUnserialize(Crypto.signatureSerialize(signature)));
            expect(proof).toEqual(true);
            done();
        })();
    });

    it('can detect wrong signatures', (done) => {
        (async function () {
            const dataToSign = BufferUtils.fromAscii('test data to sign');
            const wrongData = BufferUtils.fromAscii('wrong test data to sign');
            const keyPair = await Crypto.keyPairGenerate();
            const signature = await Crypto.signatureCreate(Crypto.keyPairPrivate(keyPair), dataToSign);
            const proof = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), wrongData, signature);
            expect(proof).toEqual(false);
            done();
        })();
    });

    it('can hash data with sha256', (done) => {
        (async function () {
            const dataToHash = BufferUtils.fromAscii('hello');
            const expectedHash = Dummy.hash1;
            const hash = await Crypto.hashLight(dataToHash);
            expect(BufferUtils.toBase64(hash)).toBe(expectedHash);
            done();
        })();
    });
});
