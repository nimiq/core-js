describe('GetDataMessage', () => {
    
    const vectorType = 23;
    const vectorHash = new Hash(Dummy.hash1);
    const vector1 = new InvVector(vectorType,vectorHash);
    const vector2 = new InvVector(vectorType,vectorHash);
    const vector3 = new InvVector(vectorType,vectorHash);

    const count = 3;
    const vectors = [vector1,vector2,vector3];

    // it('is X bytes long', () => {
    //
    //          4 bytes magic
    //         12 bytes type
    //          4 bytes length
    //          4 bytes checksum
    //        ---------------------------- 
    //         X bytes
        
        
    //     const msg1 = new GetDataMessage(count,vectors);
    //     const serialized = msg1.serialize();
    //     expect(serialized.byteLength).toBe(X);
    //     expect(msg1.serializedSize).toBe(X);
    // });


    it('is serializable and unserializable', () => {
        const msg1 = new GetDataMessage(count,vectors);
        const msg2 = GetDataMessage.unserialize(msg1.serialize());

        expect(msg2.count).toEqual(count);
        expect(msg2.vectors[0].equals(vector1)).toBe(true);
        expect(msg2.vectors[1].equals(vector2)).toBe(true);
        expect(msg2.vectors[2].equals(vector3)).toBe(true);
    });

    it('must have a well defined count (4 bytes)', () => {
        expect( () => {
            const test1 = new GetDataMessage(undefined,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test2 = new GetDataMessage(null,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test3 = new GetDataMessage(false,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test4 = new GetDataMessage(true,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test5 = new GetDataMessage(-1,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test6 = new GetDataMessage(Number.MAX_SAFE_INTEGER,vectors)
        }).toThrow('Malformed count');
    });  
	
    it('must have well defined vectors', () => {
        expect( () => {
            const test1 = new GetDataMessage(count,undefined)
        }).toThrow('Malformed vectors');
        expect( () => {
            const test1 = new GetDataMessage(count,[undefined])
        }).toThrow('Malformed vectors');
    }); 

});
