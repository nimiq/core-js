describe('CRC32', () => {

    it('should calculate correct CRC values for Arrays', ()  => {
        expect(CRC32.compute([0])).toBe(parseInt('d202ef8d', 16));

        expect(CRC32.compute([84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 104, 101, 32, 108, 97, 122, 121, 32, 100, 111, 103])).toBe(parseInt('414fa339', 16));
    });

    it('should calculate correct CRC values for Uint8Arrays', ()  => {
        expect(CRC32.compute(new Uint8Array([0]))).toBe(parseInt('d202ef8d', 16));

        expect(CRC32.compute(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))).toBe(parseInt('9270c965', 16));

        expect(CRC32.compute(new Uint8Array([84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 104, 101, 32, 108, 97, 122, 121, 32, 100, 111, 103]))).toBe(parseInt('414fa339', 16));
    });

});
