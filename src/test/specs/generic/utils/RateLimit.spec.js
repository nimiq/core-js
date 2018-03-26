describe('RateLimit', () => {
    it('correctly limits access', () => {
        const limit = new RateLimit(3);
        expect(limit.note()).toBeTruthy();
        expect(limit.note(2)).toBeTruthy();
        expect(limit.note()).toBeFalsy();
    });
    it('correctly frees limit after time', (done) => {
        const limit = new RateLimit(1, 10);
        expect(limit.note()).toBeTruthy();
        expect(limit.note()).toBeFalsy();
        setTimeout(() => {
            expect(limit.note()).toBeTruthy();
            done();
        }, 50);
    });
});
