describe('Account', () => {
    it('must have a well defined value (8 bytes)', () => {
        expect(() => {
            new Account(Account.Type.BASIC, -42);
        }).toThrowError('Malformed balance');

        expect(new Account(Account.Type.BASIC, Number.MAX_SAFE_INTEGER)).toBeTruthy();

        // invalid value
        expect(() => {
            new Account(Account.Type.BASIC, Number.MAX_SAFE_INTEGER + 1);
        }).toThrowError('Malformed balance');

        expect(() => {
            new Account(Account.Type.BASIC, NaN);
        }).toThrowError('Malformed balance');

        expect(() => {
            new Account(Account.Type.BASIC, null);
        }).toThrowError('Malformed balance');

        expect(() => {
            new Account(Account.Type.BASIC, 'string');
        }).toThrowError('Malformed balance');

    });
});
