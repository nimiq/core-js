class PlatformUtils {
    /**
     * @returns {boolean}
     */
    static isBrowser() {
        return false;
    }

    /**
     * @returns {boolean}
     */
    static isWeb() {
        return false;
    }

    /**
     * @return {boolean}
     */
    static isNodeJs() {
        return typeof process === 'object' && typeof require === 'function';
    }

    /**
     * @returns {boolean}
     */
    static supportsWebRTC() {
        return false;
    }

    /**
     * @returns {boolean}
     */
    static supportsWS() {
        return true;
    }

    /**
     * @returns {boolean}
     */
    static isOnline() {
        return true; // TODO: Online check for NodeJS?
    }

    /**
     * @returns {boolean}
     */
    static isWindows() {
        return /^win/.test(process.platform);
    }

    static get userAgentString() {
        try {
            const os = require('os');
            return os.type() + ' ' + os.arch();
        } catch (e) {
            return 'unknown';
        }
    }

    static get hardwareConcurrency() {
        return require('os').cpus().length;
    }
}

Class.register(PlatformUtils);
