describe('AccountsTreeChunkMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    let chunk;


    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();

            const account1 = new BasicAccount(25);
            const account2 = new BasicAccount(1);
            const account3 = new BasicAccount(1322);
            const account4 = new BasicAccount(93);

            const t1 = AccountsTreeNode.terminalNode('0011111111111111111111111111111111111111', account1);
            const t1Hash = t1.hash();

            const t2 = AccountsTreeNode.terminalNode('0033333333333333333333333333333333333333', account2);
            const t2Hash = t2.hash();

            const t3 = AccountsTreeNode.terminalNode('0020000000000000000000000000000000000000', account3);
            const t3Hash = t3.hash();

            const t4 = AccountsTreeNode.terminalNode('0022222222222222222222222222222222222222', account4);
            const t4Hash = t4.hash();

            const b2 = AccountsTreeNode.branchNode('002', ['0000000000000000000000000000000000000', '2222222222222222222222222222222222222'], [t3Hash, t4Hash]);
            const b2Hash = b2.hash();

            const b1 = AccountsTreeNode.branchNode('00', ['11111111111111111111111111111111111111', '2', '33333333333333333333333333333333333333'], [t1Hash, b2Hash, t2Hash]);
            const b1Hash = b1.hash();

            const r1 = AccountsTreeNode.branchNode('', ['00'], [b1Hash]);

            const nodes = [t1, t3, t4, b2, t2, b1, r1];
            chunk = new AccountsTreeChunk([t1, t2, t3], new AccountsProof(nodes));
        })().then(done, done.fail);
    });

    it('is correctly constructed', () => {
        let msg1 = new AccountsTreeChunkMessage(blockHash, chunk);

        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.chunk).toBe(chunk);

        msg1 = new AccountsTreeChunkMessage(blockHash);
        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.chunk).toBe(null);
    });

    it('is serializable and unserializable', () => {
        let msg1 = new AccountsTreeChunkMessage(blockHash, chunk);
        let msg2 = AccountsTreeChunkMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.chunk.length).toBe(msg1.chunk.length);
        expect(msg2.chunk.terminalNodes.every((node, i) => msg1.chunk.terminalNodes[i].equals(node))).toBe(true);
        expect(msg2.hasChunk()).toBeTruthy();
        expect(msg1.hasChunk()).toBeTruthy();

        msg1 = new AccountsTreeChunkMessage(blockHash);
        msg2 = AccountsTreeChunkMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.hasChunk()).toBeFalsy();
        expect(msg1.hasChunk()).toBeFalsy();
    });

    it('must have well defined arguments', () => {
        expect(() => new AccountsTreeChunkMessage('123')).toThrow();
        expect(() => new AccountsTreeChunkMessage(blockHash, '123')).toThrow();
        expect(() => new AccountsTreeChunkMessage(blockHash, blockHash)).toThrow();
    });

    it('is allowed to have no chunk', () => {
        const msg = new AccountsTreeChunkMessage(blockHash);
        expect(msg.hasChunk()).toBeFalsy();
    });
});
