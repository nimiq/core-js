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

    /**
     * @param {Array} list
     * @param {number} k
     * @yields {Array}
     */
    static *k_combinations(list, k) {
        const n = list.length;
        // Shortcut:
        if (k > n) {
            return;
        }
        const indices = Array.from(new Array(k), (x,i) => i);
        yield indices.map(i => list[i]);
        const reverseRange = Array.from(new Array(k), (x,i) => k-i-1);
        /*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
        while (true) {
            let i = k-1, found = false;
            for (i of reverseRange) {
                if (indices[i] !== i + n - k) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return;
            }
            indices[i] += 1;
            for (const j of Array.from(new Array(k-i-1), (x,k) => i+k+1)) {
                indices[j] = indices[j-1] + 1;
            }
            yield indices.map(i => list[i]);
        }
    }
}
Class.register(ArrayUtils);
