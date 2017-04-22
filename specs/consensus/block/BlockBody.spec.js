describe('BlockBody', () => {
    const rawTransaction = new RawTransaction(new PublicKey(Dummy.publicKey1), new Address(Dummy.address1), 8888,42,0); 
    const signature = new Signature(Dummy.signature1);

    const transaction1 = new Transaction(rawTransaction,signature);
    const transaction2 = new Transaction(rawTransaction,signature);
    const transaction3 = new Transaction(rawTransaction,signature);
    const transaction4 = new Transaction(rawTransaction,signature);

    const minerAddress = new Address(Dummy.address1);

    it('has a 32 byte bodyHash', (done) => {
      const blockBody1 = new BlockBody(minerAddress,[
                  transaction1,transaction2,transaction3,transaction4,
                  transaction1,transaction2,transaction3,transaction4,
                  transaction1,transaction2,transaction3,transaction4 ]);
      
      async function test(){
          const bodyHash = await blockBody1.hash()
          expect(bodyHash.byteLength).toBe(32);
          done();
      }
      test();
    });

    it('is serializable and unserializable', () => {
      const blockBody1 = new BlockBody(minerAddress,[transaction1,transaction2,transaction3,transaction4]);
      const blockBody2 = BlockBody.unserialize(blockBody1.serialize());
      expect(BufferUtils.equals(blockBody1,blockBody2)).toBe(true);
    }); 
});