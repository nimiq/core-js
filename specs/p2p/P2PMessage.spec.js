describe('P2PMessage', () => {
    const type = 'aaaaaaaaaaaa';
    const length = 256;
	const checksum = 8888888;

    it('is 24 bytes long', () => {
        
        /*
             4 bytes magic
            12 bytes type
             4 bytes length
             4 bytes checksum
           ---------------------------- 
            24 bytes
        */
        
        const msg1 = new P2PMessage(type,length,checksum);
        const serialized = msg1.serialize();
        expect(serialized.byteLength).toBe(24);
        expect(msg1.serializedSize).toBe(24);
    });


    it('is serializable and unserializable', () => {
        const msg1 = new P2PMessage(type,length,checksum);
        const msg2 = P2PMessage.unserialize(msg1.serialize());

        expect(msg2.type).toEqual(type);
        expect(msg2.length).toEqual(length);
        expect(msg2.checksum).toEqual(checksum);
    });

    it('must have a well defined type (12 bytes)', () => {
        expect( () => {
            const test1 = new P2PMessage(undefined,length,checksum)
        }).toThrow('Malformed type');
        expect( () => {
            const test2 = new P2PMessage(null,length,checksum)
        }).toThrow('Malformed type');
        expect( () => {
            const test3 = new P2PMessage(false,length,checksum)
        }).toThrow('Malformed type');
        expect( () => {
            const test4 = new P2PMessage(true,length,checksum)
        }).toThrow('Malformed type');
        expect( () => {
            const test5 = new P2PMessage('',length,checksum)
        }).toThrow('Malformed type');
        expect( () => {
            const test6 = new P2PMessage('aaaa',length,checksum)
        }).toThrow('Malformed type');
        expect( () => {
            const test7 = new P2PMessage('aaaaaaaaaaaaa',length,checksum)
        }).toThrow('Malformed type');
    });  
	
    it('must have a well defined length (4 bytes)', () => {
        expect( () => {
            const test1 = new P2PMessage(type,undefined,checksum)
        }).toThrow('Malformed length');
    }); 

    it('must have a well defined checksum (4 bytes)', () => {
        expect( () => {
            const test1 = new P2PMessage(type,length,undefined)
        }).toThrow('Malformed checksum');
    }); 

});
