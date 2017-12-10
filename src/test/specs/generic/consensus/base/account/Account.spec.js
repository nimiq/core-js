describe('Account', () => {
    it('must have a well defined value (8 bytes)', () => {
        const nonce = 1;

        expect(() => {
            new Account(Account.Type.BASIC, -42, nonce);
        }).toThrowError('Malformed balance');

        expect(new Account(Account.Type.BASIC, Number.MAX_SAFE_INTEGER, nonce)).toBeTruthy();

        // invalid value
        expect(() => {
            new Account(Account.Type.BASIC, Number.MAX_SAFE_INTEGER + 1, nonce);
        }).toThrowError('Malformed balance');

        expect(() => {
            new Account(Account.Type.BASIC, NaN, nonce);
        }).toThrowError('Malformed balance');

        expect(() => {
            new Account(Account.Type.BASIC, null, nonce);
        }).toThrowError('Malformed balance');

        expect(() => {
            new Account(Account.Type.BASIC, 'string', nonce);
        }).toThrowError('Malformed balance');

    });

    it('must have a well defined nonce (4 bytes)', () => {
        const value = 1;

        expect(() => {
            new Account(Account.Type.BASIC, value, -1);
        }).toThrowError('Malformed nonce');
        expect(() => {
            new Account(Account.Type.BASIC, value, Number.MAX_SAFE_INTEGER);
        }).toThrowError('Malformed nonce');
        expect(() => {
            new Account(Account.Type.BASIC, value, NaN);
        }).toThrowError('Malformed nonce');
        expect(() => {
            new Account(Account.Type.BASIC, value, null);
        }).toThrowError('Malformed nonce');
        expect(() => {
            new Account(Account.Type.BASIC, value, 'string');
        }).toThrowError('Malformed nonce');
    });
});
