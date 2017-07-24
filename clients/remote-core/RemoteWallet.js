class RemoteWallet extends RemoteClass {
    static get IDENTIFIER() { return 'wallet'; }
    static get ATTRIBUTES() { return ['address', 'publicKey']; }

    /**
     * Construct a remote wallet handler connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     */
    constructor(remoteConnection) {
        super(RemoteWallet.IDENTIFIER, RemoteWallet.ATTRIBUTES, {}, remoteConnection);
    }
}