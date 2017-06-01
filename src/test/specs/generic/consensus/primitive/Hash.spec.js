describe('Hash', () => {

    it('is 32 bytes long', () => {
        const hash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        expect(hash.serializedSize).toEqual(32);
        expect(() => {
            const sign = new Hash(new Uint8Array(16));
        }).toThrow('Primitive: Invalid length');

        expect(() => {
            const sign = new Hash('test');
        }).toThrow('Primitive: Invalid type');

        expect(() => {
            const sign = new Hash(new Uint8Array(33));
        }).toThrow('Primitive: Invalid length');
    });

    it('is serializable and unserializable', () => {
        const hash1 = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        const hash2 = Hash.unserialize(hash1.serialize());

        expect(hash2.toBase64()).toBe(Dummy.hash1, 'because of invariance.');
    });

    it('has an equals method', () => {
        const hash1 = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        const hash2 = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash2));

        expect(hash1.equals(hash1))
            .toBe(true, 'because hash1 == hash1');
        expect(hash1.equals(hash2))
            .toBe(false, 'because hash1 !== hash2');
        expect(hash1.equals(null))
            .toBe(false, 'because hash1 !== null');
        expect(hash1.equals(1))
            .toBe(false, 'because hash1 !== 1');
    });
});
