class StringUtils {
    /**
     * @param {string} str
     * @returns {boolean}
     */
    static isMultibyte(str) {
        return /[\uD800-\uDFFF]/.test(str);
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

}
Class.register(StringUtils);
