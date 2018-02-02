describe('VersionMessage', () => {
    const addr = new DumbPeerAddress(0, 0, new NetAddress('127.0.0.1'), PeerId.NULL, 0);
    const blockHash = Hash.fromBase64(Dummy.hash1);

    it('is correctly constructed', () => {
        const msg1 = new VersionMessage(2, addr, Block.GENESIS.HASH, blockHash);

        expect(msg1.version).toBe(2);
        expect(msg1.peerAddress.equals(addr)).toBe(true);
        expect(msg1.genesisHash.equals(Block.GENESIS.HASH)).toBe(true);
        expect(msg1.headHash.equals(blockHash)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new VersionMessage(2, addr, Block.GENESIS.HASH, blockHash);
        const msg2 = VersionMessage.unserialize(msg1.serialize());

        expect(msg2.version).toBe(msg1.version);
        expect(msg2.peerAddress.equals(msg1.peerAddress)).toBe(true);
        expect(msg2.genesisHash.equals(msg1.genesisHash)).toBe(true);
        expect(msg2.headHash.equals(msg1.headHash)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new VersionMessage(NumberUtils.UINT32_MAX+1, addr, Block.GENESIS.HASH, blockHash)).toThrow();
        expect(() => new VersionMessage(2, blockHash, Block.GENESIS.HASH, blockHash)).toThrow();
        expect(() => new VersionMessage(2, addr, addr, blockHash)).toThrow();
        expect(() => new VersionMessage(2, addr, Block.GENESIS.HASH, addr)).toThrow();
    });
});
