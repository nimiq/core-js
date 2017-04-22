describe('Block', () => {

    it('is serializable and unserializable', () => {
      const block1 = Dummy.block1;
      const size = block1.header.serializedSize + block1.body.serializedSize;
      const block2 = Block.unserialize(block1.serialize());

      expect(block2.serializedSize).toBe(size);
      expect(BufferUtils.equals(block1,block2)).toBe(true);
    });

    it('must have a well defined header (116 bytes)', () => {
        expect( () => {
            const test1 = new Block(undefined, Dummy.body1);
        }).toThrow('Malformed header');

        expect( () => {
            const test1 = new Block(null, Dummy.body1);
        }).toThrow('Malformed header');

        expect( () => {
            const test1 = new Block(1, Dummy.body1);
        }).toThrow('Malformed header');

        expect( () => {
            const test1 = new Block(new Uint8Array(101), Dummy.body1);
        }).toThrow('Malformed header');

        expect( () => {
            const test1 = new Block(Dummy.block1, Dummy.body1);
        }).toThrow('Malformed header');
    });

    it('must have a well defined body (variable size)', () => {
        expect( () => {
            const test1 = new Block(Dummy.header1, undefined);
        }).toThrow('Malformed body');

        expect( () => {
            const test1 = new Block(Dummy.header1, null);
        }).toThrow('Malformed body');

        expect( () => {
            const test1 = new Block(Dummy.header1, 1);
        }).toThrow('Malformed body');

        expect( () => {
            const test1 = new Block(Dummy.header1, new Uint8Array(101));
        }).toThrow('Malformed body');

        expect( () => {
            const test1 = new Block(Dummy.header1, Dummy.block1);
        }).toThrow('Malformed body');
    });
});