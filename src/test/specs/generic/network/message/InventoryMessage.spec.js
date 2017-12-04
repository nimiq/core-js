describe('InvMessage', () => {
    const vector1 = new InvVector(InvVector.Type.BLOCK, Hash.fromBase64(Dummy.hash1));
    const vector2 = new InvVector(InvVector.Type.BLOCK, Hash.fromBase64(Dummy.hash2));
    const vector3 = new InvVector(InvVector.Type.TRANSACTION, Hash.fromBase64(Dummy.hash3));

    it('is serializable and unserializable', () => {
        const vectors = [vector1, vector2, vector3];
        const msg1 = new InvMessage(vectors);
        const msg2 = GetDataMessage.unserialize(msg1.serialize());

        expect(msg2.vectors.length).toEqual(vectors.length);
        expect(msg2.vectors[0].equals(vector1)).toBe(true);
        expect(msg2.vectors[1].equals(vector2)).toBe(true);
        expect(msg2.vectors[2].equals(vector3)).toBe(true);
    });

    it('must have well defined vectors', () => {
        expect( () => {
            const test1 = new InvMessage(undefined);
        }).toThrow('Malformed vectors');
        expect( () => {
            const test1 = new InvMessage([undefined]);
        }).toThrow('Malformed vectors');
        expect( () => {
            const test1 = new InvMessage([undefined, undefined, undefined]);
        }).toThrow('Malformed vectors');
    });

    it('must have a length <= 1000', () => {
        const vectors = [];
        for (let i = 0; i < 1000; i++) {
            vectors.push(vector1);
        }

        expect( () => {
            const test1 = new InvMessage(vectors);
        }).not.toThrow('Malformed vectors');

        vectors.push(vector1);

        expect( () => {
            const test2 = new InvMessage(vectors);
        }).toThrow('Malformed vectors');
    });
});
