describe('InvMessage', () => {
    const vectorType = 23;
    const vectorHash = new Hash(Dummy.hash1);
    const vector1 = new InvVector(vectorType,vectorHash);
    const vector2 = new InvVector(vectorType,vectorHash);
    const vector3 = new InvVector(vectorType,vectorHash);

    const count = 3;
    const vectors = [vector1,vector2,vector3];

    // it('is 24 bytes long', () => {


    //          4 bytes magic
    //         12 bytes type
    //          4 bytes length
    //          4 bytes checksum
    //        ----------------------------
    //         24 bytes


    //     const msg1 = new InvMessage(count,vectors);
    //     const serialized = msg1.serialize();
    //     expect(serialized.byteLength).toBe(24);
    //     expect(msg1.serializedSize).toBe(24);
    // });


    it('is serializable and unserializable', () => {
        const msg1 = new InvMessage(vectors);
        const msg2 = InvMessage.unserialize(msg1.serialize());

        expect(msg2.vectors.length).toEqual(count);
        expect(msg2.vectors[0].equals(vector1)).toBe(true);
        expect(msg2.vectors[1].equals(vector2)).toBe(true);
        expect(msg2.vectors[2].equals(vector3)).toBe(true);
    });

    it('must have well defined vectors', () => {
        expect( () => {
            const test1 = new InvMessage(undefined)
        }).toThrow('Malformed vectors');
        expect( () => {
            const test1 = new GetDataMessage([undefined])
        }).toThrow('Malformed vectors');
        expect( () => {
            const test1 = new GetDataMessage([undefined,undefined,undefined])
        }).toThrow('Malformed vectors');
    });

});
