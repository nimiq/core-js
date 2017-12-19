describe('DataChannel', () => {
    it('can chunk large messages', (done) => {
        const addr = Address.fromBase64(Dummy.address1);
        const { /** @type {DataChannel} */  first, /** @type {DataChannel} */  second } = MockDataChannel.pair();
        const largeArray = new Uint8Array(100000);
        let chunks = 1;
        second.on('chunk', () => chunks++);
        second.on('message', (msg) => {
            expect(chunks).toBe(Math.ceil(largeArray.byteLength / DataChannel.CHUNK_SIZE_MAX));
            expect(msg).toEqual(largeArray.buffer);
            done();
        });
        first.send(largeArray);
    });
});
