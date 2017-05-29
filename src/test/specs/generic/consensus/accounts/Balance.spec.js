describe('Balance', () => {

    it('must have a well defined value (8 bytes)', () => {
        const value1 = -42;
        const nonce = 1;

        expect(() => {
            const balance = new Balance(value1, nonce);
        }).toThrow('Malformed value');

        const value2 = Number.MAX_SAFE_INTEGER;
        console.log('\n');
        new Balance(value2, nonce);

        // invalid value
        const value3 = value2 + 1;
        expect(() => {
            const balance = new Balance(value3, nonce);
        }).toThrow('Malformed value');

        const value4 = NaN;
        expect(() => {
            const balance = new Balance(value4, nonce);
        }).toThrow('Malformed value');

        const value5 = null;
        expect(() => {
            const balance = new Balance(value5, nonce);
        }).toThrow('Malformed value');

        const value6 = 'string';
        expect(() => {
            const balance = new Balance(value6, nonce);
        }).toThrow('Malformed value');

    });

    it('must have a well defined nonce (4 bytes)', () => {
        const value = 1;

        expect(() => {
            const balance = new Balance(value,-1);
        }).toThrow('Malformed nonce');
        expect(() => {
            const balance = new Balance(value, Number.MAX_SAFE_INTEGER);
        }).toThrow('Malformed nonce');
        expect(() => {
            const balance = new Balance(value, NaN);
        }).toThrow('Malformed nonce');
        expect(() => {
            const balance = new Balance(value, null);
        }).toThrow('Malformed nonce');
        expect(() => {
            const balance = new Balance(value, 'string');
        }).toThrow('Malformed nonce');
    });

    it('is serializable and unserializable', () => {
        const value = 42;
        const nonce = 1;
        const balance1 = new Balance(value, nonce);
        const balance2 = Balance.unserialize(balance1.serialize());

        expect(balance2.value).toEqual(value);
        expect(balance2.nonce).toEqual(nonce);
    });
});
