describe('BlockInterlink', () => {
    const Hash1 = new Hash(BufferUtils.fromBase64(Dummy.hash1));
    const Hash2 = new Hash(BufferUtils.fromBase64(Dummy.hash2));

    const BlockHashes = [Hash1, Hash2];
    const BlockInterlink1 = new BlockInterlink(BlockHashes);

    it('must have a well defined BlockHashes array', () => {
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

    it('is serializable and unserializable', () => {
        const BlockInterlink2 = BlockInterlink.unserialize(BlockInterlink1.serialize());
        expect(BufferUtils.equals(BlockInterlink1, BlockInterlink2)).toBe(true);
        expect(BufferUtils.equals(BlockInterlink1.hash(), BlockInterlink2.hash())).toBe(true);
    });

    it('must return the correct root hash', (done) => {
        const rootHash = new Hash(BufferUtils.fromBase64('JBd6ZZTwPWxWikFBawS9SrUEDiWAytbSjTjs6CKg78M='));
        (async () => {
            const hash = await BlockInterlink1.hash();
            expect(BufferUtils.equals(hash, rootHash)).toBe(true);
        })().then(done, done.fail);
    });

    it('must return the correct hash array', () => {
        hashesArray = BlockInterlink1.hashes;

        for (let i = 0; i < BlockHashes.length; i++) {
            expect(BufferUtils.equals(hashesArray[i], BlockHashes[i])).toBe(true);
         
        }
    });

    it('must return the correct lenght', () => {
        expect(BlockInterlink1.length).toBe(2);
    });
});
