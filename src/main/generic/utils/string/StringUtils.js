class StringUtils {
    /**
     * @param {string} str
     * @returns {boolean}
     */
    static isMultibyte(str) {
        return /[\uD800-\uDFFF]/.test(str);
    }

    /**
     * @param {string} str
     * @returns {boolean}
     */
    static isHex(str) {
        return /^[0-9A-Fa-f]*$/.test(str);
    }

    /**
     * @param {string} str
     * @param {number} [length]
     * @returns {boolean}
     */
    static isHexBytes(str, length) {
        if (!StringUtils.isHex(str)) return false;
        if (str.length % 2 !== 0) return false;
        if (typeof length === 'number' && str.length / 2 !== length) return false;
        return true;
    }

    /**
     * @param {string} str1
     * @param {string} str2
     * @returns {string}
     */
    static commonPrefix(str1, str2) {
        let i = 0;
        for (; i < str1.length; ++i) {
            if (str1[i] !== str2[i]) break;
        }
        return str1.substr(0, i);
    }

    /**
     * @param {string} str
     * @param {string} padString
     * @param {number} length
     * @return {string}
     */
    static lpad(str, padString, length) {
        while (str.length < length) str = padString + str;
        return str;
    }

}
Class.register(StringUtils);
