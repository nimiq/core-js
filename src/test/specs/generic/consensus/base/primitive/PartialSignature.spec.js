describe('Signature', () => {

    it('has an equals method', () => {
        const signature1 = PartialSignature.unserialize(BufferUtils.fromHex("13467fffcb9982f9518649e93d04e144c06f89f16c59c10982f676d3e8fe1205"));
        const signature2 = PartialSignature.unserialize(BufferUtils.fromHex("5865d8d5bfbf30887045ec05b5b3715b0b94fc57fd6d208d1395e3663cc86605"));

        expect(signature1.equals(signature1)).toEqual(true);
        expect(signature2.equals(signature2)).toEqual(true);
        expect(signature1.equals(signature2)).toEqual(false);
        expect(signature1.equals(null)).toEqual(false);
        expect(signature1.equals(1)).toEqual(false);
    });


    it('is serializable and unserializable', () => {
        const signature1 = PartialSignature.unserialize(BufferUtils.fromHex("13467fffcb9982f9518649e93d04e144c06f89f16c59c10982f676d3e8fe1205"));
        const signature2 = PartialSignature.unserialize(signature1.serialize());

        expect(signature2.toHex()).toEqual('13467fffcb9982f9518649e93d04e144c06f89f16c59c10982f676d3e8fe1205');
    });
});
