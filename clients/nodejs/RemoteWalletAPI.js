const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteWalletAPI extends RemoteApiComponent {
    constructor($) {
        super($);
    }

    /** @overwrites */
    getState() {
        return {
            address: this.$.wallet.address.toHex(),
            publicKey: this.$.wallet.publicKey.toBase64()
        };
    }
}
RemoteWalletAPI.MessageTypes = {
    WALLET_STATE: 'wallet'
};

module.exports = RemoteWalletAPI;