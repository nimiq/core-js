class StringUtils {
    static isMultibyte(str) {
        return /[\uD800-\uDFFF]/.test(str);
    }
}
Class.register(StringUtils);
