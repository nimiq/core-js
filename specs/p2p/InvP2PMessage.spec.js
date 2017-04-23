describe('InvP2PMessage', () => {
    const count = 42;
    const vectors = [];

    // it('is 24 bytes long', () => {
        
        
    //          4 bytes magic
    //         12 bytes type
    //          4 bytes length
    //          4 bytes checksum
    //        ---------------------------- 
    //         24 bytes
        
        
    //     const msg1 = new InvP2PMessage(count,vectors);
    //     const serialized = msg1.serialize();
    //     expect(serialized.byteLength).toBe(24);
    //     expect(msg1.serializedSize).toBe(24);
    // });


    it('is serializable and unserializable', () => {
        const msg1 = new InvP2PMessage(count,vectors);
        const msg2 = InvP2PMessage.unserialize(msg1.serialize());

        expect(msg2.type).toEqual(type);
        expect(msg2.length).toEqual(length);
        expect(msg2.checksum).toEqual(checksum);
    });

    it('must have a well defined count (4 bytes)', () => {
        expect( () => {
            const test1 = new InvP2PMessage(undefined,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test2 = new InvP2PMessage(null,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test3 = new InvP2PMessage(false,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test4 = new InvP2PMessage(true,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test5 = new InvP2PMessage(-1,vectors)
        }).toThrow('Malformed count');
        expect( () => {
            const test6 = new InvP2PMessage(Number.MAX_SAFE_INTEGER,vectors)
        }).toThrow('Malformed count');
    });  
	
    it('must have a well defined vectors', () => {
        expect( () => {
            const test1 = new InvP2PMessage(type,undefined)
        }).toThrow('Malformed vectors');
    }); 

});
