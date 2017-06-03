class Class {
    static register(cls) {
        if (typeof exports !== 'undefined') exports[cls.name] = cls;
    }
}
Class.register(Class);
