class Version {
    /**
     * @param {number} code
     * @return {boolean}
     */
    static isCompatible(code) {
        // Allow future, backwards-compatible versions.
        return code >= Version.CODE;
    }

    /**
     * @param {string} [appAgent]
     * @return {string}
     */
    static createUserAgent(appAgent) {
        appAgent = appAgent ? appAgent.trim() : '';
        if (appAgent.length > 0) appAgent = ` ${appAgent}`;
        const platformPrefix = PlatformUtils.isBrowser() ? 'browser; ' : PlatformUtils.isNodeJs() ? 'nodejs; ' : '';
        return `core-js/${Version.CORE_JS_VERSION} (${platformPrefix}${PlatformInfo.USER_AGENT_STRING})${appAgent}`;
    }
}
Version.CODE = 1;
Version.CORE_JS_VERSION = '<filled-by-build-system>';
Class.register(Version);
