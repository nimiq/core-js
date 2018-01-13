describe('KeyPair', () => {
    const catcher = {catcher: () => 0};
    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('can serialize and unserialize', () => {
        const pair1 = KeyPair.generate();
        const pair2 = KeyPair.unserialize(pair1.serialize());
        expect(pair1.privateKey).toEqual(pair2.privateKey);
        expect(pair1.publicKey).toEqual(pair2.publicKey);
        expect(pair1.isLocked).toEqual(pair2.isLocked);
    });

    it('can encrypt and decrypt after locked serialization', (done) => {
        (async () => {
            const key = new Uint8Array([1, 2, 3, 4]);
            const pair1 = KeyPair.generate();
            const privateKeyBak = PrivateKey.unserialize(pair1.privateKey.serialize());

            await pair1.lock(key);
            expect(pair1.isLocked).toBeTruthy();
            const pair2 = KeyPair.unserialize(pair1.serialize());
            expect(pair2.isLocked).toBeTruthy();

            await pair2.unlock(key);
            expect(pair2.isLocked).toBeFalsy();
            expect(privateKeyBak).toEqual(pair2.privateKey);
        })().then(done, done.fail);
    });

    it('can lock, unlock and relock', (done) => {
        (async () => {
            const key = new Uint8Array([1, 2, 3, 4]);
            const pair = KeyPair.generate();
            const privateKeyBak = PrivateKey.unserialize(pair.privateKey.serialize());

            await pair.lock(key);
            expect(pair.isLocked).toBeTruthy();
            expect(() => pair.privateKey).toThrow();
            expect(pair._unlockedPrivateKey).toBeFalsy();
            expect(Crypto.keyPairPrivate(pair._obj)).not.toEqual(privateKeyBak);

            await pair.unlock(key);
            expect(pair.isLocked).toBeFalsy();
            const privateKeyTmp = pair.privateKey;
            expect(privateKeyTmp).toEqual(privateKeyBak);

            pair.relock();
            expect(pair.isLocked).toBeTruthy();
            expect(() => pair.privateKey).toThrow();
            expect(pair._unlockedPrivateKey).toBeFalsy();
            expect(privateKeyTmp).not.toEqual(privateKeyBak);
            expect(Crypto.keyPairPrivate(pair._obj)).not.toEqual(privateKeyBak);
        })().then(done, done.fail);
    });

    it('errors when trying to unlock with wrong key', (done) => {
        spyOn(catcher, 'catcher');
        (async () => {
            const key = new Uint8Array([1, 2, 3, 4]);
            const key2 = new Uint8Array([1, 2, 3, 3]);
            const pair1 = KeyPair.generate();

            await pair1.lock(key);
            await pair1.unlock(key2).catch(catcher.catcher);
            expect(catcher.catcher).toHaveBeenCalled();
            expect(pair1.isLocked).toBeTruthy();

            await pair1.unlock(key);
            expect(pair1.isLocked).toBeFalsy();
        })().then(done, done.fail);
    });

    it('can lock under different keys', (done) => {
        (async () => {
            const key1 = new Uint8Array([1, 2, 3, 4]);
            const key2 = new Uint8Array([4, 3, 2, 1]);

            const pair = KeyPair.generate();
            const privateKeyBak = PrivateKey.unserialize(pair.privateKey.serialize());

            await pair.lock(key1);
            expect(pair.isLocked).toBeTruthy();
            expect(() => pair.privateKey).toThrow();
            expect(pair._unlockedPrivateKey).toBeFalsy();
            expect(Crypto.keyPairPrivate(pair._obj)).not.toEqual(privateKeyBak);

            await pair.unlock(key1);
            expect(pair.isLocked).toBeFalsy();
            let privateKeyTmp = pair.privateKey;
            expect(privateKeyTmp).toEqual(privateKeyBak);

            await pair.lock(key2);
            expect(pair.isLocked).toBeTruthy();
            expect(() => pair.privateKey).toThrow();
            expect(pair._unlockedPrivateKey).toBeFalsy();
            expect(privateKeyTmp).not.toEqual(privateKeyBak);
            expect(Crypto.keyPairPrivate(pair._obj)).not.toEqual(privateKeyBak);

            await pair.unlock(key2);
            expect(pair.isLocked).toBeFalsy();
            privateKeyTmp = pair.privateKey;
            expect(privateKeyTmp).toEqual(privateKeyBak);
        })().then(done, done.fail);
    });
});
