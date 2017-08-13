/**
 * @param {boolean} condition
 * @param {string} [message]
 * @returns {void}
 */
function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}
