class RemoteWallet extends RemoteClass {
    /**
     * Construct a remote wallet handler connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     */
    constructor(remoteConnection) {
        super(RemoteWallet.IDENTIFIER, RemoteWallet.ATTRIBUTES, {}, remoteConnection);
    }

    /**
     * @async
     * @overwrite
     */
    _updateState() {
        return super._updateState().then(state => {
            this.address = Nimiq.Address.fromHex(state.address);
            this.publicKey = Nimiq.PublicKey.unserialize(Nimiq.BufferUtils.fromBase64(state.publicKey));
            return state;
        });
    }

    /** @async */
    createTransaction(recipientAddr, value, fee, nonce) {
        const addressString = recipientAddr.toHex().toLowerCase();
        return this._remoteConnection.request({
            command: RemoteWallet.Commands.CREATE_TRANSACTION,
            recipientAddr: addressString,
            value: value,
            fee: fee,
            nonce: nonce
        }, message => message.type === RemoteWallet.MessageTypes.WALLET_TRANSACTION && message.data.recipientAddr.toLowerCase() === addressString
            && message.data.value === value && message.data.fee === fee && message.data.nonce === nonce)
        .then(data => Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromBase64(data.transaction)));
    }
}
RemoteWallet.IDENTIFIER = 'wallet';
RemoteWallet.ATTRIBUTES = ['address', 'publicKey'];
RemoteWallet.Commands = {
    CREATE_TRANSACTION: 'wallet-create-transaction'
};
RemoteWallet.MessageTypes = {
    WALLET_TRANSACTION: 'wallet-transaction'
};

Class.register(RemoteWallet);