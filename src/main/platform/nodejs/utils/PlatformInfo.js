class PlatformInfo {
    static get USER_AGENT_STRING() {
        try {
            const os = require('os');
            return os.type() + " " + os.arch();
        } catch (e) {
            return 'unknown';
        }
    }
}
Class.register(PlatformInfo);
