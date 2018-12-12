describe('Secret', () => {
    it('can encrypt/decrypt private key', (done) => {
        (async function () {
            const key = BufferUtils.fromAscii('password');
            const privateKey = PrivateKey.generate();
            const encrypted = await privateKey.exportEncrypted(key);
            const decrypted = await Secret.fromEncrypted(encrypted, key);
            expect(decrypted.type).toBe(Secret.Type.PRIVATE_KEY);
            expect(decrypted instanceof PrivateKey).toBe(true);
            expect(decrypted.equals(privateKey)).toBe(true);
        })().then(done, done.fail);
    });

    it('can encrypt/decrypt entropy', (done) => {
        (async function () {
            const key = BufferUtils.fromAscii('password');
            const entropy = Entropy.generate();
            const encrypted = await entropy.exportEncrypted(key);
            const decrypted = await Secret.fromEncrypted(encrypted, key);
            expect(decrypted.type).toBe(Secret.Type.ENTROPY);
            expect(decrypted instanceof Entropy).toBe(true);
            expect(decrypted.equals(entropy)).toBe(true);
        })().then(done, done.fail);
    });
});
