class Assert {
    /**
     * @param {boolean} condition
     * @param {string} [message]
     * @returns {void}
     */
    static that(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(message);
        }
    }
}
Class.register(Assert);
