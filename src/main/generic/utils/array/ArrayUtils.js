class ArrayUtils {
    /**
     * @template T
     * @param {Array.<T>} arr
     * @return {T}
     */
    static randomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * @param {Uint8Array} uintarr
     * @param {number} begin
     * @param {number} end
     * @return {Uint8Array}
     */
    static subarray(uintarr, begin, end) {
        function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

        if (begin === undefined) { begin = 0; }
        if (end === undefined) { end = uintarr.byteLength; }

        begin = clamp(begin, 0, uintarr.byteLength);
        end = clamp(end, 0, uintarr.byteLength);

        let len = end - begin;
        if (len < 0) {
            len = 0;
        }

        return new Uint8Array(uintarr.buffer, uintarr.byteOffset + begin, len);
    }
}
Class.register(ArrayUtils);
