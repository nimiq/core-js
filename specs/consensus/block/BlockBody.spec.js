describe('BlockBody', () => {
    const rawTransaction = new RawTransaction(new PublicKey(Dummy.publicKey1), new AccountAddress(Dummy.address1), 8888,42,0); 
    const signature = new Signature(Dummy.signature1);

    const transaction1 = new Transaction(rawTransaction,signature);
    const transaction2 = new Transaction(rawTransaction,signature);
    const transaction3 = new Transaction(rawTransaction,signature);
    const transaction4 = new Transaction(rawTransaction,signature);

    const minerAddress = new AccountAddress(Dummy.address1);

    it('is serializable and unserializable', () => {
      const blockBody1 = new BlockBody(minerAddress,[transaction1,transaction2,transaction3,transaction4]);
      const blockBody2 = BlockBody.unserialize(blockBody1.serialize());
      expect(BufferUtils.equals(blockBody1,blockBody2)).toBe(true);
    }); 
});