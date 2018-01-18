describe('BlockInterlinkLegacyV1', () => {
    const hash1 = Block.GENESIS.HASH;
    const hash2 = new Hash(BufferUtils.fromBase64(Dummy.hash2));

    const blockHashes = [hash1, hash2];
    const blockInterlink1 = new BlockInterlinkLegacyV1(blockHashes);

    it('must have a well defined blockHashes array', () => {
        /* eslint-disable no-unused-vars */
        expect(() => {
            const test1 = new BlockInterlinkLegacyV1(undefined);
        }).toThrowError('Malformed hashes');

        expect(() => {
            const test1 = new BlockInterlinkLegacyV1(null);
        }).toThrowError('Malformed hashes');

        expect(() => {
            const test1 = new BlockInterlinkLegacyV1(1);
        }).toThrowError('Malformed hashes');

        expect(() => {
            const test1 = new BlockInterlinkLegacyV1(new Uint8Array(101));
        }).toThrowError('Malformed hashes');
        /* eslint-enable no-unused-vars */
    });

    it('is serializable and unserializable', (done) => {
        const blockInterlink2 = BlockInterlinkLegacyV1.unserialize(blockInterlink1.serialize(), hash1);
        (async () => {
            expect(blockInterlink1.equals(blockInterlink2)).toBe(true);
            expect((await blockInterlink1.hash()).equals(await blockInterlink2.hash())).toBe(true);
        })().then(done, done.fail);
    });

    it('must return the correct root hash', (done) => {
        const rootHash = new Hash(BufferUtils.fromBase64('JUXRdoLOBiErmzMX8XoQF9Hbdfy8bbBQ2cr6BjOu2Zg='));
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
