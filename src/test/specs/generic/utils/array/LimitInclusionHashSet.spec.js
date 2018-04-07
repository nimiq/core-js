describe('LimitInclusionHashSet', () => {
    it('limits its contents', () => {
        const set = new LimitInclusionHashSet(2);
        set.addAll([1, 2, 3]);

        expect(set.isEmpty()).toBeFalsy();
        expect(set.length).toBe(2);
        expect(set.values()).toEqual(['2', '3']);

        set.add(4);
        set.remove(1);

        expect(set.isEmpty()).toBeFalsy();
        expect(set.length).toBe(2);
        expect(set.values()).toEqual(['3', '4']);

        set.remove(4);

        expect(set.isEmpty()).toBeFalsy();
        expect(set.length).toBe(1);
        expect(set.values()).toEqual(['3']);

        set.clear();

        expect(set.isEmpty()).toBeTruthy();
        expect(set.length).toBe(0);
    });

    it('cannot limit to 0', () => {
        expect(() =>  new LimitInclusionHashSet(0)).toThrow();
    });

    it('is efficient', () => {
        const set = new LimitInclusionHashSet(40000);
        for (let i = 0; i < 500000; i++) {
            set.add(i);
        }
    });
});
