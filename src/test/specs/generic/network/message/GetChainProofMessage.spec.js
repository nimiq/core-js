describe('GetChainProofMessage', () => {
    it('is serializable and unserializable', () => {
        const msg1 = new GetChainProofMessage();
        const msg2 = GetChainProofMessage.unserialize(msg1.serialize());

        expect(msg2).toBeTruthy();
    });
});
