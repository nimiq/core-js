class LogNative {
    constructor() {
        this._global_level = Log.DEBUG;
        this._tag_levels = {};
        if (window.localStorage) {
            const c = window.localStorage.getItem('log_tag_levels');
            if (c) this._tag_levels = c;
        }
    }

    isLoggable(tag, level) {
        if (tag && this._tag_levels[tag]) {
            return this._tag_levels[tag] <= level;
        }
        return this._global_level <= level;
    }

    setLoggable(tag, level) {
        this._tag_levels[tag] = level;
        if (window.localStorage) {
            window.localStorage.setItem('log_tag_levels', this._tag_levels);
        }
    }

    msg(level, tag, args) {
        if (!this.isLoggable(tag, level)) return;
        if (tag && tag.name) tag = tag.name;
        if (tag) args.unshift(tag + ':');
        args.unshift(`[${new Date().toTimeString().substr(0, 8)}:${Log._level_tag(level)}]`);
        if (console.error && level >= Log.ERROR) {
            console.error.apply(null, args);
        } else if (console.warn && level >= Log.WARNING) {
            console.warn.apply(null, args);
        } else if (console.info && level >= Log.INFO) {
            console.info.apply(null, args);
        } else if (console.debug && level >= Log.DEBUG) {
            console.debug.apply(null, args);
        } else if (console.trace && level <= Log.TRACE) {
            console.trace.apply(null, args);
        } else {
            console.log.apply(null, args);
        }
    }
}
