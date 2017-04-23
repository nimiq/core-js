describe('GetDataP2PMessage', () => {
    
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
        
        
    //     const msg1 = new GetDataP2PMessage(count,vectors);
    //     const serialized = msg1.serialize();
    //     expect(serialized.byteLength).toBe(X);
    //     expect(msg1.serializedSize).toBe(X);
    // });


    it('is serializable and unserializable', () => {
        const msg1 = new GetDataP2PMessage(count,vectors);
        const msg2 = GetDataP2PMessage.unserialize(msg1.serialize());

        expect(msg2.count).toEqual(count);
        expect(msg2.vectors[0].equals(vector1)).toBe(true);
        expect(msg2.vectors[1].equals(vector2)).toBe(true);
        expect(msg2.vectors[2].equals(vector3)).toBe(true);
    });

    it('must have a well defined count (4 bytes)', () => {
        expect( () => {
            const test1 = new GetDataP2PMessage(undefined,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test2 = new GetDataP2PMessage(null,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test3 = new GetDataP2PMessage(false,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test4 = new GetDataP2PMessage(true,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test5 = new GetDataP2PMessage(-1,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test6 = new GetDataP2PMessage(Number.MAX_SAFE_INTEGER,vectors)
        }).toThrow('Malformed count');
    });  
	
    it('must have well defined vectors', () => {
        expect( () => {
            const test1 = new GetDataP2PMessage(count,undefined)
        }).toThrow('Malformed vectors');
        expect( () => {
            const test1 = new GetDataP2PMessage(count,[undefined])
        }).toThrow('Malformed vectors');
    }); 

});
