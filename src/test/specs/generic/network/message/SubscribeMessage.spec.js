describe('GetDataMessage', () => {
    const vector1 = new InvVector(InvVector.Type.BLOCK, Hash.fromBase64(Dummy.hash1));
    const vector2 = new InvVector(InvVector.Type.BLOCK, Hash.fromBase64(Dummy.hash2));
    const vector3 = new InvVector(InvVector.Type.TRANSACTION, Hash.fromBase64(Dummy.hash3));
    const vectors = [vector1, vector2, vector3];

    it('is serializable and unserializable', () => {
        const msg1 = new GetDataMessage(vectors);
        const msg2 = GetDataMessage.unserialize(msg1.serialize());

        expect(msg2.vectors.length).toEqual(vectors.length);
        expect(msg2.vectors[0].equals(vector1)).toBe(true);
        expect(msg2.vectors[1].equals(vector2)).toBe(true);
        expect(msg2.vectors[2].equals(vector3)).toBe(true);
    });
	
    it('must have well defined vectors', () => {
        expect( () => {
            const test1 = new GetDataMessage(undefined);
        }).toThrow('Malformed vectors');
        expect( () => {
            const test1 = new GetDataMessage([undefined]);
        }).toThrow('Malformed vectors');
    });
});
