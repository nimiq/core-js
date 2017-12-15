describe('LimitIterable', () => {
    it('correctly limits arrays', () => {
        const arr = [1, 2, 3, 4];
        const limit = new LimitIterable(arr, 2);

        let expectedVal = 1;
        for (const val of limit) {
            expect(val).toBe(expectedVal);
            ++expectedVal;
        }
        expect(expectedVal).toBe(3);
    });

    it('correctly limits iterators', () => {
        const arr = [1, 2, 3, 4];
        const limit = new LimitIterable((arr)[Symbol.iterator](), 2);

        let expectedVal = 1;
        for (const val of limit) {
            expect(val).toBe(expectedVal);
            ++expectedVal;
        }
        expect(expectedVal).toBe(3);
    });
});
