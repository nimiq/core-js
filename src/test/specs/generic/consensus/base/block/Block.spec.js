describe('Block', () => {
    let testBlockchain, block;

    beforeEach(function (done) {
        (async function () {
            // create testing blockchain with only genesis and dummy users
            testBlockchain = await TestBlockchain.createVolatileTest(0);
            block = await testBlockchain.createBlock();
        })().then(done, done.fail);
    });

    it('must have a well defined header (116 bytes)', () => {
        const interlink = block.interlink;
        expect(() => {
            const test1 = new Block(undefined, interlink);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(null, interlink);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(1, interlink);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(new Uint8Array(101), interlink);
        }).toThrow('Malformed header');

        expect(() => {
            const test1 = new Block(block, interlink);
        }).toThrow('Malformed header');
    });

    it('must have a well defined interlink', () => {
        const header = block.header;
        expect(() => {
            const test1 = new Block(header, undefined);
        }).toThrow('Malformed interlink');

        expect(() => {
            const test1 = new Block(header, null);
        }).toThrow('Malformed interlink');

        expect(() => {
            const test1 = new Block(header, 1);
        }).toThrow('Malformed interlink');

        expect(() => {
            const test1 = new Block(header, new Uint8Array(101));
        }).toThrow('Malformed interlink');

        expect(() => {
            const test1 = new Block(header, block);
        }).toThrow('Malformed interlink');
    });

    it('must have a well defined body (optional)', () => {
        const header = block.header;
        const interlink = block.interlink;
        expect(() => {
            const test1 = new Block(header, interlink, 1);
        }).toThrow('Malformed body');

        expect(() => {
            const test1 = new Block(header, interlink, new Uint8Array(101));
        }).toThrow('Malformed body');

        expect(() => {
            const test1 = new Block(header, interlink, block);
        }).toThrow('Malformed body');
    });

    it('is serializable and unserializable', () => {
        const size = block.header.serializedSize + block.interlink.serializedSize + block.body.serializedSize + 1 /*bodyPresent*/;
        const block2 = Block.unserialize(block.serialize());

        expect(block2.serializedSize).toBe(size);
        expect(BufferUtils.equals(block, block2)).toBe(true);
    });

    it('can handle light blocks', () => {
        const block = GenesisConfig.GENESIS_BLOCK.toLight();
        expect(block.isLight()).toBeTruthy();

        const block2 = Block.unserialize(block.serialize());
        expect(block2.isLight()).toBeTruthy();
        expect(() => block2.body).toThrow();
        expect(block.equals(block2)).toBeTruthy();

        const block3 = block2.toFull(GenesisConfig.GENESIS_BLOCK.body);
        expect(block3.isFull()).toBeTruthy();
        expect(block3.equals(GenesisConfig.GENESIS_BLOCK)).toBeTruthy();
    });
});
