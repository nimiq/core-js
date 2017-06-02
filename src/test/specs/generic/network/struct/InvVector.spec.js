describe('InvVector', () => {
    const type = 42;
    const hash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));

    it('is 36 bytes long', () => {

        /*
         4 bytes type
         32 bytes invHash
         ----------------------------
         36 bytes
         */

        const vec1 = new InvVector(type, hash);
        const serialized = vec1.serialize();
        expect(serialized.byteLength).toBe(36);
        expect(vec1.serializedSize).toBe(36);
    });

    it('is serializable and unserializable', () => {
        const vec1 = new InvVector(type, hash);
        const vec2 = InvVector.unserialize(vec1.serialize());

        expect(vec2.type).toBe(type);
        expect(vec2.hash.equals(hash)).toBe(true);
    });

});
