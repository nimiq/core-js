const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteWalletAPI extends RemoteApiComponent {
    /**
     * Create a new wallet API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
    }

    /** @overwrite */
    getState() {
        return {
            address: this.$.wallet.address.toHex(),
            publicKey: this.$.wallet.publicKey.toBase64()
        };
    }
}
/** @enum */
RemoteWalletAPI.MessageTypes = {
    WALLET_STATE: 'wallet'
};

module.exports = RemoteWalletAPI;