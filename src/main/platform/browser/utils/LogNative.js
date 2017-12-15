class LogNative {
    constructor() {
        this._global_level = Log.INFO;
        this._tag_levels = {};
        try {
            if (window.localStorage) {
                try {
                    let c = window.localStorage.getItem('log_tag_levels');
                    if (c && typeof c === 'string') c = JSON.parse(c);
                    if (c && typeof c === 'object') this._tag_levels = c;
                } catch (e) {
                    console.warn('Failed to load log configuration from local storage.');
                }
            }
        } catch (e) {
            // ignore
        }
    }

    isLoggable(tag, level) {
        if (tag && this._tag_levels[tag]) {
            return this._tag_levels[tag] <= level;
        }
        if (this._tag_levels['*']) {
            return this._tag_levels['*'] <= level;
        }
        return this._global_level <= level;
    }

    setLoggable(tag, level) {
        if (tag && tag.name) tag = tag.name;
        this._tag_levels[tag] = level;
        if (window.localStorage) {
            window.localStorage.setItem('log_tag_levels', JSON.stringify(this._tag_levels));
        }
    }

    msg(level, tag, args) {
        if (tag && tag.name) tag = tag.name;
        if (!this.isLoggable(tag, level)) return;
        if (tag) args.unshift(tag + ':');
        args.unshift(`[${Log.Level.toStringTag(level)} ${new Date().toTimeString().substr(0, 8)}]`);
        if (console.error && level >= Log.ERROR) {
            console.error.apply(console, args);
        } else if (console.warn && level >= Log.WARNING) {
            console.warn.apply(console, args);
        } else if (console.info && level >= Log.INFO) {
            console.info.apply(console, args);
        } else if (console.debug && level >= Log.DEBUG) {
            console.debug.apply(console, args);
        } else if (console.trace && level <= Log.TRACE) {
            console.trace.apply(console, args);
        } else {
            console.log.apply(console, args);
        }
    }
}
Class.register(LogNative);
