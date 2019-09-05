import Nimiq from '../../../../dist/web.esm.js';

describe('ESM', () => {
    it('was loaded correctly', () => {
        const set = new Nimiq.HashSet();
        set.addAll([1, 2, 3]);

        expect(set.contains(2)).toBeTruthy();
        expect(set.contains(4)).toBeFalsy();
    });
});
