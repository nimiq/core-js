const Nimiq = require('../../dist/node.js');
const RemoteAPI = require('./RemoteAPI.js');

/**
 * Base Class for the components of the Remote API.
 */
class RemoteApiComponent {
    constructor($) {
        this.$ = $;
        this._listeners = {};
    }

    /**
     * @public
     * Handle the message if it supported.
     * @param {AuthenticatedConnection} connection - The connection that sent the message and that a potential answer should be sent to
     * @param {object} message - The message
     * @returns {boolean} - whether the message was handled.
     */
    handleMessage(connection, message) {
        return false;
    }

    /**
     * @protected
     * Checks whether a listener type registration is supported.
     * @param {string} type - The listener type.
     * @returns {boolean} - whether the listener type is supported.
     */
    _isValidListenerType(type) {
        return false;
    }

    /**
     * @public
     * Register a listener if that type is supported.
     * @param {AuthenticatedConnection} connection - The connection that wants to register a listener.
     * @param {object} message - The request message.
     * @returns {boolean} - whether the type is supported.
     */
    registerListener(connection, message) {
        let type = message.type;
        if (!this._isValidListenerType(type)) {
            return false;
        }
        if (!this._listeners[type]) {
            this._listeners[type] = new Set();
        }
        this._listeners[type].add(connection);
        connection.sendInfo('Listener for type '+type+' registered.');
        return true;
    }

    /**
     * @public
     * Unregister a listener if that type is supported.
     * @param {AuthenticatedConnection} connection - The connection that wants to unregister a listener.
     * @param {object} message - The request message.
     * @returns {boolean} whether the type is supported
     */
    unregisterListener(connection, message) {
        let type = message.type;
        if (!this._isValidListenerType(type)) {
            return false;
        }
        if (type in this._listeners) {
            this._listeners[type].delete(connection);
        }
        connection.sendInfo('Listener for type '+type+' unregistered.');
        return true;
    }

    /**
     * @public
     * Unregister all listeners registered for a connection.
     * @param {AuthenticatedConnection} connection - The connection that wants to unregister all listeners.
     */
    unregisterListeners(connection) {
        for (const type in this._listeners) {
            this._unregisterListener(connection, type);
        }
    }

    /**
     * @protected
     * Broadcast an event to all registered listeners.
     * @param {string} type - The event type to broadcast
     * @param {*} data - Data associated to the event.
     */
    _broadcast(type, data) {
        if (!this._listeners[type]) return;
        for (let connection of this._listeners[type]) {
            if (connection.connected) {
                connection.send(type, data);
            }
        }
    }

    /**
     * @protected
     * Serialize an object to base 64.
     * @param {*} serializable - An object that implements a serialize method.
     * @returns {string} - The base 64 representation.
     */
    _serializeToBase64(serializable) {
        return Nimiq.BufferUtils.toBase64(serializable.serialize());
    }

    /**
     * @public
     * Get the state of this object.
     * @returns {object} - The current state
     */
    getState() {
        return {};
    }
}

module.exports = RemoteApiComponent;