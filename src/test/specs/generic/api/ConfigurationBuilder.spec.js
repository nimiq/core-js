describe('Client.ConfigurationBuilder', () => {

    it('can validate a boolean type', () => {
        const builder = new Client.ConfigurationBuilder();
        expect(builder._requiredType(true, 'myVariable', 'boolean')).toBe(true);
        expect(builder._requiredType(false, 'myVariable', 'boolean')).toBe(false);
    });

    it('can detect mismatching config', () => {
        const builder = new Client.ConfigurationBuilder();
        builder.volatile(true);
        builder.feature(Client.Feature.LOCAL_HISTORY);
        expect(() => builder.build()).toThrowError('Local history is not available with volatile storage');
    });

});
