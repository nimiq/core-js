describe('InclusionHashSet', () => {
    it('can clear itself', () => {
        const set = new InclusionHashSet();
        set.addAll([1, 2]);
        set.add(3);

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
        const set = new InclusionHashSet();
        set.addAll([1, 2, 3]);

        expect(set.contains(2)).toBeTruthy();
        expect(set.contains(4)).toBeFalsy();
    });

    it('can be cloned', () => {
        const set = new InclusionHashSet();
        set.addAll([1, 2, 3]);

        const otherSet = set.clone();

        expect(otherSet.contains(2)).toBeTruthy();
        expect(otherSet.contains(4)).toBeFalsy();
        expect(otherSet.values()).toEqual(['1', '2', '3']);
    });

    it('can bulk remove', () => {
        const set = new InclusionHashSet();
        set.addAll([1, 2, 3]);

        set.removeAll([1, 2]);

        expect(set.values()).toEqual(['3']);
        // Test iterator
        for (const v of set) {
            expect(v).toBe('3');
        }
    });
});
