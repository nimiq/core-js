class RemoteWallet extends RemoteClass {
    /**
     * Construct a remote wallet handler connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     */
    constructor(remoteConnection) {
        super(RemoteWallet.IDENTIFIER, RemoteWallet.ATTRIBUTES, {}, remoteConnection);
    }

    /**
     * @overwrites
     */
    async _updateState() {
        return super._updateState().then(state => {
            this.address = Nimiq.Address.fromHex(state.address);
            this.publicKey = Nimiq.PublicKey.unserialize(Nimiq.BufferUtils.fromBase64(state.publicKey));
            return state;
        });
    }
}
RemoteWallet.IDENTIFIER = 'wallet';
RemoteWallet.ATTRIBUTES = ['address', 'publicKey'];

Class.register(RemoteWallet);