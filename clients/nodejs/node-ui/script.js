class App {

    constructor() {
        this._launch();
    }

    async _launch() {
        const urlParams = this._getUrlParams();
        const port = parseInt(urlParams.port) || 8648;
        this._rpcClient = new RpcClient('localhost', port);
        this._rpcSettingsUi = new RpcSettingsUi(document.querySelector('#rpc-settings'), this._rpcClient);
        this._rpcClient.on('error', message => ErrorMessage.show(message));
        this._rpcClient.on('cant-authenticate', () => this._rpcSettingsUi.show());
        const authenticationPromise = new Promise(resolve => this._rpcClient.on('authenticated', resolve));
        this._rpcClient.ping();
        await authenticationPromise;

        await this._initNimiqInstance();
        new Miner(this.$);
    }

    _getUrlParams() {
        const query = window.location.hash.substr(1);
        if (!query) {
            return {};
        }

        return query.split('&').reduce((params, param) => {
            const [ key, value ] = param.split('=');
            params[decodeURIComponent(key)] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
            return params;
        }, {});
    }

    async _initNimiqInstance() {
        const [consensus, blockchain, network, accounts, miner] = await Promise.all([
            new RpcConsensus(this._rpcClient),
            new RpcBlockchain(this._rpcClient),
            new RpcNetwork(this._rpcClient),
            new RpcAccounts(this._rpcClient),
            new RpcMiner(this._rpcClient)
        ]);
        // schedule some additional updates during startup
        [consensus, blockchain, network, accounts, miner].forEach(component => {
            setTimeout(() => component._update(), 1000);
            setTimeout(() => component._update(), 3000);
            setTimeout(() => component._update(), 6000);
            setTimeout(() => component._update(), 10000);
        });
        this.$ = { consensus, blockchain, network, accounts, miner };
    }
}

window.app = new App();
