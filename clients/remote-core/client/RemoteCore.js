class RemoteCore {
    /**
     * Construct a new remote core.
     * @param url - A websocket URL (protocol ws: or wss: for secure connections) pointing to a node running the RemoteAPI.
     * @param authenticationSecret - a password to be used for authentication with the server
     * @param liveUpdates - A list of strings naming the components that should get resynced with the server or 'all' to live update them all
     */
    constructor(url, authenticationSecret, liveUpdates) {
        const shouldLiveUpdate = component => liveUpdates === 'all' || (Array.isArray(liveUpdates) && liveUpdates.indexOf(component)!==-1);
        this._remoteConnection = new RemoteConnection(url, authenticationSecret);
        this.accounts = new RemoteAccounts(this._remoteConnection);
        this.blockchain = new RemoteBlockchain(this._remoteConnection, this.accounts, shouldLiveUpdate('blockchain'));
        this.consensus = new RemoteConsensus(this._remoteConnection, shouldLiveUpdate('consensus'));
        this.mempool = new RemoteMempool(this._remoteConnection, shouldLiveUpdate('mempool'));
        this.miner = new RemoteMiner(this._remoteConnection, shouldLiveUpdate('miner'));
        this.network = new RemoteNetwork(this._remoteConnection, shouldLiveUpdate('network'));
        this.wallet = new RemoteWallet(this._remoteConnection);

        this._remoteConnection.on(RemoteConnection.Events.CONNECTION_ERROR, () => console.error('Error connecting to '+url));
        this._remoteConnection.on(RemoteConnection.Events.MESSAGE, message => {
            if (message.type === 'error') {
                console.error(message.data);
            }
        });
    }
}
Class.register(RemoteCore);