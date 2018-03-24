class Class {
    static get scope() {
        if (typeof exports !== 'undefined') return exports;
        return window;
    }

    static register(cls) {
        if (typeof exports !== 'undefined') exports[cls.name] = cls;
    }
}
Class.register(Class);
