describe('MempoolMessage', () => {
    it('is serializable and unserializable', () => {
        const msg1 = new MempoolMessage();
        const msg2 = MempoolMessage.unserialize(msg1.serialize());

        expect(msg2).toBeTruthy();
    });
});
