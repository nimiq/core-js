describe('HashSet', () => {
    it('can clear itself', () => {
        const set = new HashSet();
        set.addAll([1, 2, 3]);

        expect(set.isEmpty()).toBeFalsy();
        expect(set.length).toBe(3);

        set.remove(1);

        expect(set.isEmpty()).toBeFalsy();
        expect(set.length).toBe(2);

        set.clear();

        expect(set.isEmpty()).toBeTruthy();
        expect(set.length).toBe(0);
    });

    it('can check whether a value is in the set', () => {
        const set = new HashSet();
        set.addAll([1, 2, 3]);

        expect(set.contains(2)).toBeTruthy();
        expect(set.contains(4)).toBeFalsy();
    });
});
