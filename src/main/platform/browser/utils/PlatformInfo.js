class PlatformInfo {
    static get USER_AGENT_STRING() {
        try {
            return window.navigator.platform;
        } catch (e) {
            return 'unknown';
        }
    }
}
Class.register(PlatformInfo);
