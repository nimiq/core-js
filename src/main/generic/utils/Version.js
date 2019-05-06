class Version {
    /**
     * @param {number} code
     * @return {boolean}
     */
    static isCompatible(code) {
        return code >= 1;
    }

    /**
     * @param {string} [appAgent]
     * @return {string}
     */
    static createUserAgent(appAgent) {
        appAgent = appAgent ? appAgent.trim() : '';
        if (appAgent.length > 0) appAgent = ` ${appAgent}`;
        const platformPrefix = PlatformUtils.isBrowser() ? 'browser; ' : PlatformUtils.isNodeJs() ? 'nodejs; ' : '';
        return `core-js/${Version.CORE_JS_VERSION} (${platformPrefix}${PlatformUtils.userAgentString})${appAgent}`;
    }
}
Version.CODE = 2;
Version.CORE_JS_VERSION = '<filled-by-build-system>';
Class.register(Version);
