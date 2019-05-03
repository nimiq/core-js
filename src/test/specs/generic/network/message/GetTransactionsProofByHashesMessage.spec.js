describe('GetTransactionsProofByHashesMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    const hash1 = Hash.fromBase64(Dummy.hash2);
    const hash2 = Hash.fromBase64(Dummy.hash3);

    it('is serializable and unserializable', () => {
        const msg1 = new GetTransactionsProofByHashesMessage(blockHash, [hash1, hash2]);
        const msg2 = GetTransactionsProofByHashesMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.hashes.length).toBe(msg1.hashes.length);
        expect(msg2.hashes.every((addr, i) => msg1.hashes[i].equals(addr))).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetTransactionsProofByHashesMessage(blockHash)).toThrow();
        expect(() => new GetTransactionsProofByHashesMessage(blockHash, null)).toThrow();
        expect(() => new GetTransactionsProofByHashesMessage(blockHash, [])).toThrow();
        expect(() => new GetTransactionsProofByHashesMessage(blockHash, hash1)).toThrow();
    });
});
