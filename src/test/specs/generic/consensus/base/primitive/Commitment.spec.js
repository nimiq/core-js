describe('Commitment', () => {
    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('is serializable and unserializable', (done) => {
        (async function () {
            const commitment1 = (await CommitmentPair.generate()).commitment;
            const commitment2 = Commitment.unserialize(commitment1.serialize());

            expect(commitment1.equals(commitment2)).toEqual(true);
            expect(commitment1.serialize().byteLength).toEqual(commitment1.serializedSize);
            expect(commitment2.serialize().byteLength).toEqual(commitment2.serializedSize);
        })().then(done, done.fail);
    });

    it('has an equals method', () => {
        const commitment1 = new Commitment(BufferUtils.fromBase64('K38BsHxjOe06cgAW5000CjdQpNu6zQIzszvaeaHyij8='));
        const commitment2 = new Commitment(BufferUtils.fromBase64('OIqozapbmyEr0AdAPDdo60rK+HL7/4jjH7l2moqOOwU='));
        const commitment3 = new Commitment(BufferUtils.fromBase64('OIqozapbmyEr0AdAPDdo60rK+HL7/4jjH7l2moqOOwU='));

        expect(commitment1.equals(1)).toEqual(false);
        expect(commitment1.equals(null)).toEqual(false);
        expect(commitment1.equals(commitment1)).toEqual(true);
        expect(commitment1.equals(commitment2)).toEqual(false);
        expect(commitment2.equals(commitment3)).toEqual(true);
    });

    it('can sum up commitments', (done) => {
        (async function () {
            const commitment1 = new Commitment(BufferUtils.fromBase64('K38BsHxjOe06cgAW5000CjdQpNu6zQIzszvaeaHyij8='));
            const commitment2 = new Commitment(BufferUtils.fromBase64('OIqozapbmyEr0AdAPDdo60rK+HL7/4jjH7l2moqOOwU='));
            const commitment3 = new Commitment(BufferUtils.fromBase64('hkdksHj6avXHBuTvE0fTmOP2LmFaDlv99HMnMEFgtxw='));

            expect((await Commitment.sum([commitment1, commitment2])).equals(commitment3)).toEqual(true);
            expect((await Commitment.sum([commitment2, commitment1])).equals(commitment3)).toEqual(true);
        })().then(done, done.fail);
    });
});
