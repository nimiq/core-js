class RemoteCore extends RemoteObservable {
    /**
     * Construct a new remote core.
     * @param url - A websocket URL (protocol ws: or wss: for secure connections) pointing to a node running the RemoteAPI.
     * @param authenticationSecret - a password to be used for authentication with the server
     * @param liveUpdates - A list of strings naming the components that should get resynced with the server or 'all' to live update them all
     */
    constructor(url, authenticationSecret, liveUpdates) {
        super(RemoteCore.Events);
        const shouldLiveUpdate = component => liveUpdates === 'all' || (Array.isArray(liveUpdates) && liveUpdates.indexOf(component)!==-1);
        this._remoteConnection = new RemoteConnection(url, authenticationSecret);
        this.accounts = new RemoteAccounts(this._remoteConnection);
        this.blockchain = new RemoteBlockchain(this._remoteConnection, this.accounts, shouldLiveUpdate('blockchain'));
        this.consensus = new RemoteConsensus(this._remoteConnection, shouldLiveUpdate('consensus'));
        this.mempool = new RemoteMempool(this._remoteConnection, shouldLiveUpdate('mempool'));
        this.miner = new RemoteMiner(this._remoteConnection, shouldLiveUpdate('miner'));
        this.network = new RemoteNetwork(this._remoteConnection, shouldLiveUpdate('network'));
        this.wallet = new RemoteWallet(this._remoteConnection);

        this._remoteConnection.on(RemoteConnection.Events.CONNECTION_ERROR, errorMessage => {
            console.error('Error connecting to ', url);
            this.fire(RemoteCore.Events.CONNECTION_ERROR, errorMessage);
        });
        this._remoteConnection.on(RemoteConnection.Events.CONNECTION_LOST, () => this.fire(RemoteCore.Events.CONNECTION_LOST));
        this._remoteConnection.on(RemoteConnection.Events.CONNECTION_ESTABLISHED, () => this.fire(RemoteCore.Events.CONNECTION_ESTABLISHED));
        this._remoteConnection.on(RemoteConnection.Events.MESSAGE, message => {
            if (message.type === 'error') {
                console.error('Error message from remote server: ' + message.data);
            }
        });
        this._notifyOnInitialized();
    }

    _notifyOnInitialized() {
        const createPromise = component => new Promise((resolve, reject) => {
            const timeout = setTimeout(reject, RemoteCore.INITIALIZATION_TIMEOUT);
            component.on(RemoteClass.Events.INITIALIZED, () => {
                clearTimeout(timeout);
                resolve();
            });
        });
        Promise.all([createPromise(this.blockchain), createPromise(this.consensus), createPromise(this.mempool), createPromise(this.miner),
            createPromise(this.network), createPromise(this.wallet)])
            .then(() => this.fire(RemoteCore.Events.INITIALIZED))
            .catch(e => { console.error(e); this.fire(RemoteCore.Events.INITIALIZATION_ERROR, e); });
    }
}
RemoteCore.INITIALIZATION_TIMEOUT = 45000;
RemoteCore.Events = {
    CONNECTION_ESTABLISHED: 'connection-established',
    CONNECTION_LOST: 'connection-lost',
    CONNECTION_ERROR: 'connection-error',
    INITIALIZED: 'initialized',
    INITIALIZATION_ERROR: 'initialization-error'
};
Class.register(RemoteCore);