describe('BlockHeader', () => {
    const prevHash = new Hash(BufferUtils.fromBase64(Dummy.hash1));
    const bodyHash = new Hash(BufferUtils.fromBase64(Dummy.hash2));
    const accountsHash = new Hash(BufferUtils.fromBase64(Dummy.hash3));
    const difficulty = BlockUtils.difficultyToCompact(1);
    const timestamp = 1;
    const nonce = 1;

    it('is 118 bytes long', () => {

        //   2 bytes version
        //  32 bytes prevHash
        //  32 bytes bodyHash
        //  32 bytes accountsHash
        //   4 bytes difficulty
        //   4 bytes height
        //   4 bytes timestamp
        //   8 bytes nonce
        // ----------------------------
        // 118 bytes

        const blockHeader1 = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, 1, timestamp, nonce);

        const serialized = blockHeader1.serialize();

        expect(serialized.byteLength).toBe(118);
    });


    it('must have a well defined prevHash (32 bytes)', () => {
        expect(() => {
            const test1 = new BlockHeader(undefined, bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect(() => {
            const test2 = new BlockHeader(null, bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect(() => {
            const test3 = new BlockHeader(true, bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect(() => {
            const test4 = new BlockHeader(new Address(new Uint8Array(20)), bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect(() => {
            const test5 = new BlockHeader(new Signature(new Uint8Array(Crypto.signatureSize)), bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect(() => {
            const test5 = new BlockHeader(new ArrayBuffer(32), bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed prevHash');
    });

    it('must have a well defined bodyHash (32 bytes)', () => {
        expect(() => {
            const test1 = new BlockHeader(prevHash, undefined, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect(() => {
            const test2 = new BlockHeader(prevHash, null, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect(() => {
            const test3 = new BlockHeader(prevHash, true, accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect(() => {
            const test4 = new BlockHeader(prevHash, new Address(new Uint8Array(20)), accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect(() => {
            const test5 = new BlockHeader(prevHash, new Signature(new Uint8Array(Crypto.signatureSize)), accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect(() => {
            const test5 = new BlockHeader(prevHash, new Uint8Array(32), accountsHash, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
    });

    it('must have a well defined accountsHash (32 bytes)', () => {
        expect(() => {
            const test1 = new BlockHeader(prevHash, bodyHash, undefined, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect(() => {
            const test2 = new BlockHeader(prevHash, bodyHash, null, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect(() => {
            const test3 = new BlockHeader(prevHash, bodyHash, true, difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect(() => {
            const test4 = new BlockHeader(prevHash, bodyHash, new Address(new Uint8Array(20)), difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect(() => {
            const test5 = new BlockHeader(prevHash, bodyHash, new Signature(new Uint8Array(Crypto.signatureSize)), difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect(() => {
            const test5 = new BlockHeader(prevHash, bodyHash, new Uint8Array(32), difficulty, 2, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
    });

    it('must have a well defined nonce (8 bytes)', () => {
        const nonce1 = NumberUtils.UINT64_MAX;
        const blockHeader1 = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, 2, timestamp, nonce1);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());
        const nonce2 = blockHeader2.nonce;

        expect(nonce2).toBe(nonce1);
    });

    it('must have a well defined difficulty (4 bytes)', () => {
        const difficulty1 = NumberUtils.UINT32_MAX;
        const compact1 = BlockUtils.difficultyToCompact(difficulty1);
        const blockHeader1 = new BlockHeader(prevHash, bodyHash, accountsHash, compact1, 2, timestamp, nonce);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());
        const compact2 = blockHeader2.nBits;

        expect(compact2).toBe(compact1);
    });

    it('must have a well defined timestamp (4 bytes)', () => {
        const timestamp1 = NumberUtils.UINT32_MAX;
        const blockHeader1 = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, 2, timestamp1, nonce);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());
        const timestamp2 = blockHeader2.timestamp;

        expect(timestamp2).toBe(timestamp1);
    });

    it('is serializable and unserializable', () => {
        const blockHeader1 = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());

        expect(blockHeader2.prevHash.equals(prevHash)).toBe(true);
        expect(blockHeader2.bodyHash.equals(bodyHash)).toBe(true);
        expect(blockHeader2.accountsHash.equals(accountsHash)).toBe(true);
        expect(blockHeader2.difficulty).toBe(BlockUtils.compactToDifficulty(difficulty));
        expect(blockHeader2.timestamp).toBe(timestamp);
    });

    it('can falsify an invalid proof-of-work', (done) => {
        const blockHeader = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, 2, timestamp, nonce);
        blockHeader.verifyProofOfWork()
            .then((isValid) => {
                expect(isValid).toBe(false);
                done();
            });
    });

    xit('can verify a valid proof-of-work', (done) => {
        const blockHeader = BlockHeader.unserialize(new SerialBuffer(BufferUtils.fromBase64(Dummy.header2)));
        blockHeader.verifyProofOfWork()
            .then((isValid) => {
                expect(isValid).toBe(true);
                done();
            });
    });
});
