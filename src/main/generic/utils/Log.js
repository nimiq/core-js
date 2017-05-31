class Log {
    static _level_tag(level) {
        switch (level) {
            case Log.TRACE:
                return 'T';
            case Log.VERBOSE:
                return 'V';
            case Log.DEBUG:
                return 'D';
            case Log.INFO:
                return 'I';
            case Log.WARNING:
                return 'W';
            case Log.ERROR:
                return 'E';
            case Log.ASSERT:
                return 'A';
            default:
                return '*';
        }
    }

    static get instance() {
        if (!Log._instance) {
            Log._instance = new Log(new LogNative());
        }
        return Log._instance;
    }

    constructor(native) {
        this._native = native;
    }

    setLoggable(tag, level) {
        this._native.setLoggable(tag, level);
    }

    get level() {
        return this._native._global_level;
    }

    set level(l) {
        this._native._global_level = l;
    }

    msg(level, tag, args) {
        this._native.msg(level, tag, args);
    }

    static d() {
        let tag, args;
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.DEBUG, tag, args);
    }

    static e() {
        let tag, args;
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.ERROR, tag, args);
    }

    static i() {
        let tag, args;
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.INFO, tag, args);
    }

    static v() {
        let tag, args;
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.VERBOSE, tag, args);
    }

    static w() {
        let tag, args;
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.WARNING, tag, args);
    }

    static t() {
        let tag, args;
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.TRACE, tag, args);
    }
}
Log.TRACE = 1;
Log.VERBOSE = 2;
Log.DEBUG = 3;
Log.INFO = 4;
Log.WARNING = 5;
Log.ERROR = 6;
Log.ASSERT = 7;
Log._instance = null;
Class.register(Log);
