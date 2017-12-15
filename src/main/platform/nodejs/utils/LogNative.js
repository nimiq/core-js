class LogNative {
    constructor() {
        this._global_level = Log.INFO;
        this._tag_levels = {};
        this._chalk = require('chalk');
    }

    isLoggable(tag, level) {
        if (tag && this._tag_levels[tag]) {
            return this._tag_levels[tag] <= level;
        }
        return this._global_level <= level;
    }

    setLoggable(tag, level) {
        this._tag_levels[tag] = level;
    }

    /**
     * @param {Log.Level} level
     * @param {string} tag
     * @param {Array} args
     */
    msg(level, tag, args) {
        if (!this.isLoggable(tag, level)) return;
        if (tag && tag.name) tag = tag.name;
        if (tag) args.unshift(tag + ':');
        let prefix = `[${Log.Level.toStringTag(level)} ${new Date().toTimeString().substr(0, 8)}] `;
        const chalk = this._chalk;
        if (level >= Log.ERROR) {
            console.log(prefix + chalk.red(args.join(' ')));
        } else if (level >= Log.WARNING) {
            console.log(prefix + chalk.yellow(args.join(' ')));
        } else if (level >= Log.INFO) {
            console.log(prefix + chalk.cyan(args.join(' ')));
        } else if (level >= Log.DEBUG) {
            console.log(prefix + chalk.magenta(args.join(' ')));
        } else if (level <= Log.TRACE) {
            console.trace(prefix + args.join(' '));
        } else {
            console.log(prefix + args.join(' '));
        }
    }
}
Class.register(LogNative);
