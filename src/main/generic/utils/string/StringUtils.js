class StringUtils {
    /**
     * @param {string} str
     * @returns {boolean}
     */
    static isMultibyte(str) {
        return /[\uD800-\uDFFF]/.test(str);
    }
}
Class.register(StringUtils);
