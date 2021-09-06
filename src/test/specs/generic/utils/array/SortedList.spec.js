describe('SortedList', () => {
    it('correctly inserts elements', () => {
        const s = new SortedList();

        s.add(4);
        expect(s.values()).toEqual([4]);

        s.add(2);
        expect(s.values()).toEqual([2,4]);

        s.add(3);
        expect(s.values()).toEqual([2,3,4]);

        s.add(8);
        expect(s.values()).toEqual([2,3,4,8]);

        s.add(6);
        expect(s.values()).toEqual([2,3,4,6,8]);

        s.add(5);
        expect(s.values()).toEqual([2,3,4,5,6,8]);

        s.add(4);
        expect(s.values()).toEqual([2,3,4,4,5,6,8]);
    });

    it('correctly inserts elements (2)', () => {
        let s = new SortedList([1,2,3,4]);

        s.add(2);
        expect(s.values()).toEqual([1,2,2,3,4]);

        s = new SortedList([1,2,3,4]);
        s.add(4);
        expect(s.values()).toEqual([1,2,3,4,4]);
    });

    it('can clear itself', () => {
        const s = new SortedList();

        s.add(3);
        s.add(1);
        s.add(2);

        expect(s.length).toBe(3);
        s.clear();
        expect(s.length).toBe(0);
    });

    it('can indexOf', () => {
        let s = new SortedList();

        s.add(3);
        s.add(1);

        expect(s.indexOf(3)).toBe(1);
        expect(s.indexOf(1)).toBe(0);
        expect(s.indexOf(2)).toBe(-1);

        s = new SortedList([1,2,2,3,4,5]);

        expect(s.indexOf(2)).toBe(1);
        expect(s.indexOf(3)).toBe(3);
        expect(s.indexOf(5)).toBe(5);
    });

    it('can shift', () => {
        const s = new SortedList();

        s.add(3);
        s.add(1);
        s.add(2);

        expect(s.length).toBe(3);
        expect(s.values()).toEqual([1,2,3]);
        expect(s.shift()).toBe(1);
        expect(s.length).toBe(2);
        expect(s.values()).toEqual([2,3]);
    });

    it('can pop', () => {
        const s = new SortedList();

        s.add(3);
        s.add(1);
        s.add(2);

        expect(s.length).toBe(3);
        expect(s.values()).toEqual([1,2,3]);
        expect(s.pop()).toBe(3);
        expect(s.length).toBe(2);
        expect(s.values()).toEqual([1,2]);
    });

    it('can remove elements', () => {
        const s = new SortedList([1, 2, 3]);

        expect(s.length).toBe(3);
        expect(s.values()).toEqual([1,2,3]);
        s.remove(2);
        s.remove(5);
        expect(s.length).toBe(2);
        expect(s.values()).toEqual([1,3]);
    });

    it('can be copied', () => {
        const s1 = new SortedList([1, 2, 3]);
        const s2 = s1.copy();

        expect(s1.length).toBe(3);
        expect(s1.values()).toEqual([1,2,3]);
        expect(s2.length).toBe(3);
        expect(s2.values()).toEqual([1,2,3]);

        s1.remove(1);
        s2.add(4);

        expect(s1.length).toBe(2);
        expect(s1.values()).toEqual([2,3]);
        expect(s2.length).toBe(4);
        expect(s2.values()).toEqual([1,2,3,4]);
    });
});
