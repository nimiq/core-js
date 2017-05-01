class ObjectUtils {
    static cast(o, clazz) {
        if (!o) return o;
        o.__proto__ = clazz.prototype;
        return o;
    }
}
Class.register(ObjectUtils);