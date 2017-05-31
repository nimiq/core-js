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
            let privateSerialized = Crypto.privateKeySerialize(Crypto.keyPairPrivate(keyPair));
            let publicSerialized = Crypto.publicKeySerialize(Crypto.keyPairPublic(keyPair));
            let sign = await Crypto.signatureCreate(Crypto.keyPairPrivate(keyPair), data);
            let verify = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), data, sign);
            let falsify = await Crypto.signatureVerify(Crypto.keyPairPublic(keyPair), data2, sign);

            let privateUnserialized = Crypto.privateKeyUnserialize(privateSerialized);
            let publicUnserialized = Crypto.publicKeyUnserialize(publicSerialized);

            let verify2 = await Crypto.signatureVerify(publicUnserialized, data, sign);
            expect(verify2).toBe(verify);

            let falsify2 = await Crypto.signatureVerify(publicUnserialized, data2, sign);
            expect(falsify2).toBe(falsify);

            let sign2 = await Crypto.signatureCreate(privateUnserialized, data);
            expect(sign2.length).toBe(sign.length);

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
