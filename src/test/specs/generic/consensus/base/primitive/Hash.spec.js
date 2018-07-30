describe('Hash', () => {

    it('is 32 bytes long', () => {
        const hash = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        expect(hash.serializedSize).toEqual(32);
        expect(() => {
            const sign = new Hash(new Uint8Array(16));
        }).toThrow(new Error('Primitive: Invalid length'));

        expect(() => {
            const sign = new Hash('test');
        }).toThrow(new Error('Primitive: Invalid type'));

        expect(() => {
            const sign = new Hash(new Uint8Array(33));
        }).toThrow(new Error('Primitive: Invalid length'));
    });

    it('is serializable and unserializable', () => {
        const hash1 = Hash.unserialize(BufferUtils.fromBase64(Dummy.hash1));
        const hash2 = Hash.unserialize(hash1.serialize());

        expect(hash2.toBase64()).toBe(Dummy.hash1);
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

    it('can hash data with blake2b', () => {
        const dataToHash = BufferUtils.fromAscii('hello');
        const expectedHash = Dummy.hash1;
        const hash = Hash.blake2b(dataToHash);
        expect(BufferUtils.toBase64(hash.serialize())).toBe(expectedHash);
    });

    it('can hash data with sha256', () => {
        const dataToHash = BufferUtils.fromAscii(Dummy.shaHash.input);
        const expectedHash = Dummy.shaHash.sha256Hex;
        const hash = Hash.sha256(dataToHash);
        expect(BufferUtils.toHex(hash.serialize())).toBe(expectedHash);
    });

    it('can hash data with sha512', () => {
        const dataToHash = BufferUtils.fromAscii(Dummy.shaHash.input);
        const expectedHash = Dummy.shaHash.sha512Hex;
        const hash = Hash.sha512(dataToHash);
        expect(BufferUtils.toHex(hash.serialize())).toBe(expectedHash);
    });
});
