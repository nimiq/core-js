describe('Message', () => {
    const type = 'aaaaaaaaaaaa';

    it('is 24 bytes long', () => {

        /*
             4 bytes magic
            12 bytes type
             4 bytes length
             4 bytes checksum
           ----------------------------
            24 bytes
        */

        const msg1 = new Message(type);
        const serialized = msg1.serialize();
        expect(serialized.byteLength).toBe(24);
        expect(msg1.serializedSize).toBe(24);
    });


    it('is serializable and unserializable', () => {
        const msg1 = new Message(type);
        const msg2 = Message.unserialize(msg1.serialize());

        expect(msg2.type).toEqual(type);
        // TODO check length
        // TODO check checksum
    });

    it('must have a well defined type (12 bytes)', () => {
        expect( () => {
            const test1 = new Message(undefined)
        }).toThrow('Malformed type');
        expect( () => {
            const test2 = new Message(null)
        }).toThrow('Malformed type');
        expect( () => {
            const test3 = new Message(false)
        }).toThrow('Malformed type');
        expect( () => {
            const test4 = new Message(true)
        }).toThrow('Malformed type');
        expect( () => {
            const test5 = new Message('')
        }).toThrow('Malformed type');
        expect( () => {
            const test7 = new Message('aaaaaaaaaaaaa')
        }).toThrow('Malformed type');
    });

    // TOD Message.length || Message.checksum 
    /*
    it('must have a well defined length (4 bytes)', () => {
        expect( () => {
            const test1 = new Message(type,undefined,checksum)
        }).toThrow('Malformed length');
        expect( () => {
            const test1 = new Message(type,-1,checksum)
        }).toThrow('Malformed length');
        expect( () => {
            const test1 = new Message(type,-100,checksum)
        }).toThrow('Malformed length');
        expect( () => {
            const test1 = new Message(type,Math.E,checksum)
        }).toThrow('Malformed length');
        expect( () => {
            const test1 = new Message(type,Number.MAX_SAFE_INTEGER,checksum)
        }).toThrow('Malformed length');
    });

    it('must have a well defined checksum (4 bytes)', () => {
        expect( () => {
            const test1 = new Message(type,length,undefined)
        }).toThrow('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,null)
        }).toThrow('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,-1)
        }).toThrow('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,-100)
        }).toThrow('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,Math.E)
        }).toThrow('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,Number.MAX_SAFE_INTEGER)
        }).toThrow('Malformed checksum');
    });
    */

});
