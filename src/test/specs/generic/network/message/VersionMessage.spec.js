describe('VersionMessage', () => {
    const addr = new DumbPeerAddress(0, 0, NetAddress.fromIP('127.0.0.1'), PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1)), 0, Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1)));
    const blockHash = Hash.fromBase64(Dummy.hash1);
    const challenge = new Uint8Array(VersionMessage.CHALLENGE_SIZE);

    it('is correctly constructed', () => {
        const msg1 = new VersionMessage(2, addr, GenesisConfig.GENESIS_HASH, blockHash, challenge);

        expect(msg1.version).toBe(2);
        expect(msg1.peerAddress.equals(addr)).toBe(true);
        expect(msg1.genesisHash.equals(GenesisConfig.GENESIS_HASH)).toBe(true);
        expect(msg1.headHash.equals(blockHash)).toBe(true);
        expect(BufferUtils.equals(msg1.challengeNonce, challenge)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new VersionMessage(2, addr, GenesisConfig.GENESIS_HASH, blockHash, challenge);
        const msg2 = VersionMessage.unserialize(msg1.serialize());

        expect(msg2.version).toBe(msg1.version);
        expect(msg2.peerAddress.equals(msg1.peerAddress)).toBe(true);
        expect(msg2.genesisHash.equals(msg1.genesisHash)).toBe(true);
        expect(msg2.headHash.equals(msg1.headHash)).toBe(true);
        expect(BufferUtils.equals(msg2.challengeNonce, msg1.challengeNonce)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new VersionMessage(NumberUtils.UINT32_MAX+1, addr, GenesisConfig.GENESIS_HASH, blockHash, challenge)).toThrow();
        expect(() => new VersionMessage(2, blockHash, GenesisConfig.GENESIS_HASH, blockHash, challenge)).toThrow();
        expect(() => new VersionMessage(2, addr, addr, blockHash, challenge)).toThrow();
        expect(() => new VersionMessage(2, addr, GenesisConfig.GENESIS_HASH, addr, challenge)).toThrow();
        expect(() => new VersionMessage(2, addr, GenesisConfig.GENESIS_HASH, blockHash, addr)).toThrow();
    });
});
