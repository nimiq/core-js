describe('Message', () => {
    /*
    const type = 'aaaaaaaaaaaa';

    it('must have a well defined type (12 bytes)', () => {
        expect( () => {
            const test1 = new Message(undefined); // eslint-disable-line no-unused-vars
        }).toThrow('Malformed type');
        expect( () => {
            const test2 = new Message(null); // eslint-disable-line no-unused-vars
        }).toThrow('Malformed type');
        expect( () => {
            const test3 = new Message(false); // eslint-disable-line no-unused-vars
        }).toThrow('Malformed type');
        expect( () => {
            const test4 = new Message(true); // eslint-disable-line no-unused-vars
        }).toThrow('Malformed type');
        expect( () => {
            const test5 = new Message(''); // eslint-disable-line no-unused-vars
        }).toThrow('Malformed type');
        expect( () => {
            const test7 = new Message('aaaaaaaaaaaaa'); // eslint-disable-line no-unused-vars
        }).toThrow('Malformed type');
    });
    */

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
