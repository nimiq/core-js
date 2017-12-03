describe('BlockInterlink', () => {
    const hash1 = new Hash(BufferUtils.fromBase64(Dummy.hash1));
    const hash2 = new Hash(BufferUtils.fromBase64(Dummy.hash2));

    const blockHashes = [hash1, hash2];
    const blockInterlink1 = new BlockInterlink(blockHashes);

    it('must have a well defined blockHashes array', () => {
        /* eslint-disable no-unused-vars */
        expect(() => {
            const test1 = new BlockInterlink(undefined);
        }).toThrow('Malformed blockHashes');

        expect(() => {
            const test1 = new BlockInterlink(null);
        }).toThrow('Malformed blockHashes');

        expect(() => {
            const test1 = new BlockInterlink(1);
        }).toThrow('Malformed blockHashes');

        expect(() => {
            const test1 = new BlockInterlink(new Uint8Array(101));
        }).toThrow('Malformed blockHashes');
        /* eslint-enable no-unused-vars */
    });

    it('is serializable and unserializable', (done) => {
        const blockInterlink2 = BlockInterlink.unserialize(blockInterlink1.serialize());
        (async () => {
            expect(blockInterlink1.equals(blockInterlink2)).toBe(true);
            expect((await blockInterlink1.hash()).equals(await blockInterlink2.hash())).toBe(true);
        })().then(done, done.fail);
    });

    it('must return the correct root hash', (done) => {
        const rootHash = new Hash(BufferUtils.fromBase64('JBd6ZZTwPWxWikFBawS9SrUEDiWAytbSjTjs6CKg78M='));
        (async () => {
            const hash = await blockInterlink1.hash();
            expect(hash.equals(rootHash)).toBe(true);
        })().then(done, done.fail);
    });

    it('must return the correct hash array', () => {
        const hashesArray = blockInterlink1.hashes;
        for (let i = 0; i < blockHashes.length; i++) {
            expect(hashesArray[i].equals(blockHashes[i])).toBe(true);
        }
    });

    it('must return the correct length', () => {
        expect(blockInterlink1.length).toBe(2);
    });
});
