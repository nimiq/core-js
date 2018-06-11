describe('IteratorUtils', () => {
    it('can alternate between iterators', () => {
        const it1 = function* () {
            yield 1;
            yield 2;
            yield 3;
        };
        const it2 = function* () {
            yield 4;
        };
        const it3 = function* () {
            yield 5;
            yield 6;
            yield 7;
        };

        expect(Array.from(IteratorUtils.alternate(it1(), it2(), it3()))).toEqual([1, 4, 5, 2, 6, 3, 7]);
    });
});
