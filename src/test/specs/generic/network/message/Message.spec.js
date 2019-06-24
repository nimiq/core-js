describe('Message', () => {
    /*
    const type = 'aaaaaaaaaaaa';

    it('must have a well defined type (12 bytes)', () => {
        expect( () => {
            const test1 = new Message(undefined); // eslint-disable-line no-unused-vars
        }) .toThrowError('Malformed type');
        expect( () => {
            const test2 = new Message(null); // eslint-disable-line no-unused-vars
        }).toThrowError('Malformed type');
        expect( () => {
            const test3 = new Message(false); // eslint-disable-line no-unused-vars
        }).toThrowError('Malformed type');
        expect( () => {
            const test4 = new Message(true); // eslint-disable-line no-unused-vars
        }).toThrowError('Malformed type');
        expect( () => {
            const test5 = new Message(''); // eslint-disable-line no-unused-vars
        }).toThrowError('Malformed type');
        expect( () => {
            const test7 = new Message('aaaaaaaaaaaaa'); // eslint-disable-line no-unused-vars
        }).toThrowError('Malformed type');
    });
    */

    /*
    it('must have a well defined length (4 bytes)', () => {
        expect( () => {
            const test1 = new Message(type,undefined,checksum)
        }).toThrowError('Malformed length');
        expect( () => {
            const test1 = new Message(type,-1,checksum)
        }).toThrowError('Malformed length');
        expect( () => {
            const test1 = new Message(type,-100,checksum)
        }).toThrowError('Malformed length');
        expect( () => {
            const test1 = new Message(type,Math.E,checksum)
        }).toThrowError('Malformed length');
        expect( () => {
            const test1 = new Message(type,Number.MAX_SAFE_INTEGER,checksum)
        }).toThrowError('Malformed length');
    });

    it('must have a well defined checksum (4 bytes)', () => {
        expect( () => {
            const test1 = new Message(type,length,undefined)
        }).toThrowError('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,null)
        }).toThrowError('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,-1)
        }).toThrowError('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,-100)
        }).toThrowError('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,Math.E)
        }).toThrowError('Malformed checksum');
        expect( () => {
            const test1 = new Message(type,length,Number.MAX_SAFE_INTEGER)
        }).toThrowError('Malformed checksum');
    });
    */

});
