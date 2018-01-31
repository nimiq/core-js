class Log {
    /**
     * @returns {Log}
     */
    static get instance() {
        if (!Log._instance) {
            Log._instance = new Log(new LogNative());
        }
        return Log._instance;
    }

    /**
     * @param {LogNative} native
     */
    constructor(native) {
        /** @type {LogNative} */
        this._native = native;
    }

    /**
     * @param {string} tag
     * @param {Log.Level} level
     */
    setLoggable(tag, level) {
        this._native.setLoggable(tag, level);
    }

    /** @type {Log.Level} */
    get level() {
        return this._native._global_level;
    }

    /** @type {Log.Level} */
    set level(l) {
        this._native._global_level = l;
    }

    /**
     * @param {Log.Level} level
     * @param {string|{name:string}} tag
     * @param {Array} args
     */
    msg(level, tag, args) {
        if (this._native.isLoggable(tag, level)) {
            for (let i = 0; i < args.length; ++i) {
                if (typeof args[i] === 'function') {
                    args[i] = args[i]();
                }
                if (typeof args[i] === 'object') {
                    if (typeof args[i].toString === 'function') {
                        args[i] = args[i].toString();
                    } else if (args[i].constructor && args[i].constructor.name) {
                        args[i] = `{Object: ${args[i].constructor.name}}`;
                    } else {
                        args[i] = '{Object}';
                    }
                }
            }
            this._native.msg(level, tag, args);
        }
    }

    /**
     * @param {?string|{name:string}} [tag=undefined]
     * @param {string|function():string} message
     * @param {...*} args
     */
    static d(tag, message, ...args) {
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.DEBUG, tag, args);
    }

    /**
     * @param {?string|{name:string}} [tag=undefined]
     * @param {string|function():string} message
     * @param {...*} args
     */
    static e(tag, message, ...args) {
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.ERROR, tag, args);
    }

    /**
     * @param {?string|{name:string}} [tag=undefined]
     * @param {string|function():string} message
     * @param {...*} args
     */
    static i(tag, message, ...args) {
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.INFO, tag, args);
    }

    /**
     * @param {?string|{name:string}} [tag=undefined]
     * @param {string|function():string} message
     * @param {...*} args
     */
    static v(tag, message, ...args) {
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.VERBOSE, tag, args);
    }

    /**
     * @param {?string|{name:string}} [tag=undefined]
     * @param {string|function():string} message
     * @param {...*} args
     */
    static w(tag, message, ...args) {
        if (arguments.length >= 2) {
            tag = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        } else {
            tag = undefined;
            args = Array.prototype.slice.call(arguments, 0);
        }
        Log.instance.msg(Log.WARNING, tag, args);
    }

    /**
     * @param {?string|{name:string}} [tag=undefined]
     * @param {string|function():string} message
     * @param {...*} args
     */
    static t(tag, message, ...args) {
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
/**
 * @enum {number}
 */
Log.Level = {
    TRACE: 1,
    VERBOSE: 2,
    DEBUG: 3,
    INFO: 4,
    WARNING: 5,
    ERROR: 6,
    ASSERT: 7,

    /**
     * @param {Log.Level} level
     */
    toStringTag: function (level) {
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
};
Log.TRACE = Log.Level.TRACE;
Log.VERBOSE = Log.Level.VERBOSE;
Log.DEBUG = Log.Level.DEBUG;
Log.INFO = Log.Level.INFO;
Log.WARNING = Log.Level.WARNING;
Log.ERROR = Log.Level.ERROR;
Log.ASSERT = Log.Level.ASSERT;
Log._instance = null;

Log.d.tag = (tag) => Log.d.bind(null, tag);
Log.e.tag = (tag) => Log.e.bind(null, tag);
Log.i.tag = (tag) => Log.i.bind(null, tag);
Log.v.tag = (tag) => Log.v.bind(null, tag);
Log.w.tag = (tag) => Log.w.bind(null, tag);
Log.t.tag = (tag) => Log.t.bind(null, tag);

Class.register(Log);
