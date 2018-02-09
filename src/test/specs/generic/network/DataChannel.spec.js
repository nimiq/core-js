describe('DataChannel', () => {
    it('can chunk large messages', (done) => {
        const { /** @type {DataChannel} */  first, /** @type {DataChannel} */  second } = MockDataChannel.pair();
        const largeArray = new SerialBuffer(new Uint8Array(100000));
        largeArray.writePos = /*magic*/ 4;
        largeArray.writeVarUint(0);
        largeArray.writeUint32(100000);
        let chunks = 1;
        second.on('chunk', () => chunks++);
        second.on('message', (msg) => {
            expect(chunks).toBe(Math.ceil(largeArray.byteLength / DataChannel.CHUNK_SIZE_MAX));
            expect(msg).toEqual(largeArray.buffer);
            done();
        });
        first.send(largeArray);
    });

    it('can set custom timeouts', (done) => {
        const { /** @type {DataChannel} */  first, /** @type {DataChannel} */  second } = MockDataChannel.pair();
        expect(second.isExpectingMessage(Message.Type.BLOCK)).toBe(false);
        second.expectMessage(Message.Type.BLOCK, () => {
            expect(second.isExpectingMessage(Message.Type.BLOCK)).toBe(false);
            done();
        }, 100, 150);
        expect(second.isExpectingMessage(Message.Type.BLOCK)).toBe(true);
    });

    it('can set custom timeouts for multiple messages', (done) => {
        const addr = Address.fromBase64(Dummy.address1);
        const { /** @type {DataChannel} */  first, /** @type {DataChannel} */  second } = MockDataChannel.pair();
        const largeArray = new SerialBuffer(new Uint8Array(1024));
        largeArray.writePos = /*magic*/ 4;
        largeArray.writeVarUint(Message.Type.INV);
        largeArray.writeUint32(1024);

        expect(second.isExpectingMessage(Message.Type.BLOCK)).toBe(false);
        expect(second.isExpectingMessage(Message.Type.INV)).toBe(false);
        second.expectMessage([Message.Type.BLOCK, Message.Type.INV], () => {
            done.fail();
        }, 1000, 1500);
        expect(second.isExpectingMessage(Message.Type.BLOCK)).toBe(true);
        expect(second.isExpectingMessage(Message.Type.INV)).toBe(true);

        second.on('message', (msg) => {
            expect(second.isExpectingMessage(Message.Type.BLOCK)).toBe(false);
            expect(second.isExpectingMessage(Message.Type.INV)).toBe(false);
            done();
        });
        first.send(largeArray);
    });
});
