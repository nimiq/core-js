class RpcClient extends Nimiq.Observable {
    constructor(host, port, user, password) {
        super();
        this._host = host;
        this._port = port;
        this._user = user;
        this._password = password;
    }

    get port() {
        return this._port;
    }

    set port(port) {
        this._port = port;
    }

    set user(user) {
        this._user = user;
    }

    set password(password) {
        this._password = password;
    }

    async ping() {
        try {
            await this.fetch('consensus');
            return 'pong';
        } catch(e) {
            return false;
        }
    }

    fetch(method, ...params) {
        while (params.length > 0 && typeof params[params.length - 1] === 'undefined') params.pop();
        RpcClient._currentMessageId = (RpcClient._currentMessageId || 0) + 1;
        const jsonrpc = JSON.stringify({
            jsonrpc: '2.0',
            id: RpcClient._currentMessageId,
            method: method,
            params: params
        });
        const protocol = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http' : 'https';

        return fetch(`${protocol}://${this._host}:${this._port}`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${btoa(`${this._user}:${this._password}`)}`
            },
            body: jsonrpc
        }).then(response => {
            if (response.status === 401) {
                throw new Error('Connection Failed: Authentication Required.');
            }
            this._canAuthenticate();
            if (response.status !== 200) {
                throw new Error(`Connection Failed. ${response.statusText ? response.statusText
                    : `Error Code: ${response.status}`}`);
            }

            return response.json();
        }).then(data => {
            if (data.error) {
                throw new Error(`An Error Occurred: ${data.error.message}`);
            }
            return data.result;
        }).catch(e => {
            const message = e.message || e;
            if (message.indexOf('Authentication Required') !== -1) {
                this._cantAuthenticate();
            } else if (message.indexOf('Connection Failed') !== -1 || message.indexOf('Error Occurred') !== -1) {
                this.fire('error', message);
            } else {
                // An error message thrown by the browser (e.g. "Failed to fetch")
                this.fire('error', `${message} - Make sure that the application is running. Press F12 to see additional details.`);
            }
            throw e;
        });
    }

    _canAuthenticate() {
        if (this._authenticationState === 'authenticated') return;
        this._authenticationState = 'authenticated';
        this.fire('authenticated');
    }

    _cantAuthenticate() {
        if (this._authenticationState === 'cant-authenticate') return;
        this._authenticationState = 'cant-authenticate';
        this.fire('cant-authenticate');
    }
}

class RpcComponent extends Nimiq.Observable {
    constructor(rpcClient) {
        super();
        this._rpcClient = rpcClient;
        this._updateTimer = setInterval(() => this._update(), this.constructor.UPDATE_INTERVAL * 1000);
        return this._update().then(() => this);
    }

    static get UPDATE_INTERVAL() {
        return 15;
    }

    async _update() {}
}

class RpcConsensus extends RpcComponent {
    get established() {
        return this._consensusState === 'established';
    }

    async _update() {
        const consensusState = await this._rpcClient.fetch('consensus');
        if (consensusState === this._consensusState) return;
        this._consensusState = consensusState;
        this.fire(consensusState); // 'established', 'lost' or 'syncing'
    }
}

class RpcBlockchain extends RpcComponent {
    get height() {
        return this._head.height;
    }

    get head() {
        return this._head;
    }

    async _update() {
        const head = await this._rpcClient.fetch('getBlockByNumber', 'latest');
        if (this._head && head.hash === this._head.hash) return;
        head.height = head.number;
        head.difficulty = parseFloat(head.difficulty);
        this._head = head;
        this.fire('head-changed', head);
    }
}

class RpcNetwork extends RpcComponent {
    get peerCount() {
        return this._peerCount;
    }

    async _update() {
        const peerCount = await this._rpcClient.fetch('peerCount');
        if (peerCount === this._peerCount) return;

        const oldPeerCount = this._peerCount;
        this._peerCount = peerCount;

        if (peerCount > oldPeerCount) {
            this.fire('peer-joined');
        } else {
            this.fire('peer-left');
        }
        this.fire('peers-changed');
    }
}

class RpcAccounts extends RpcComponent {
    get(address) {
        return this._rpcClient.fetch('getAccount', address);
    }
}

class RpcMiner extends RpcComponent {
    get enabled() {
        return this._enabled;
    }

    set enabled(enabled) {
        this._rpcClient.fetch('mining', enabled).then(enabled => {
            if (enabled === this._enabled) return;
            this._enabled = enabled;
            this.fire(enabled ? 'enabled' : 'disabled');
            this._updateProperties('hashrate');
            setTimeout(() => this._updateProperties('hashrate'), 1500);
        });
    }

    get hashrate() {
        return this._hashrate;
    }

    get threads() {
        return this._minerThreads;
    }

    set threads(threads) {
        this._rpcClient.fetch('minerThreads', threads).then(threads => {
            this._propertyUpdated('minerThreads', threads);
            this._updateProperties('hashrate');
            setTimeout(() => this._updateProperties('hashrate'), 1500);
            setTimeout(() => this._updateProperties('hashrate'), 3000);
            setTimeout(() => this._updateProperties('hashrate'), 5000);
            setTimeout(() => this._updateProperties('hashrate'), 8000);
            setTimeout(() => this._updateProperties('hashrate'), 12000);
            setTimeout(() => this._updateProperties('hashrate'), 16000);
        });
    }

    get address() {
        return this._minerAddress;
    }

    get pool() {
        return this._pool;
    }

    set pool(poolOrBoolean) {
        this._rpcClient.fetch('pool', poolOrBoolean).then(pool => {
            this._poolUpdated(pool);
            if (pool) {
                this._propertyUpdated('poolConnectionState', Nimiq.BasePoolMiner.ConnectionState.CONNECTING);
                setTimeout(() => this._updateProperties('poolConnectionState', 'poolConfirmedBalance'), 1000);
                setTimeout(() => this._updateProperties('poolConnectionState', 'poolConfirmedBalance'), 3500);
            }
            this._updateProperties('poolConnectionState', 'poolConfirmedBalance');
        });
    }

    get connectionState() {
        return this._poolConnectionState;
    }

    get confirmedBalance() {
        return this._poolConfirmedBalance;
    }

    async _update() {
        const [enabled, pool] = await Promise.all([
            this._rpcClient.fetch('mining'),
            this._rpcClient.fetch('pool'),
            this._updateProperties('hashrate', 'minerThreads', 'minerAddress',
                'poolConnectionState', 'poolConfirmedBalance')
        ]);

        if (enabled !== this._enabled) {
            this._enabled = enabled;
            this.fire(enabled ? 'enabled' : 'disabled');
        }
        this._poolUpdated(pool);
    }

    _getEventNameForProperty(propertyName) {
        return {
            hashrate: 'hashrate-changed',
            minerThreads: 'threads-changed',
            minerAddress: 'address-changed',
            poolConnectionState: 'connection-state',
            poolConfirmedBalance: 'confirmed-balance'
        }[propertyName];
    }

    _propertyUpdated(propertyName, propertyValue) {
        if (propertyValue === this[`_${propertyName}`]) return;
        this[`_${propertyName}`] = propertyValue;
        const eventName = this._getEventNameForProperty(propertyName);
        if (!eventName) throw new Error(`Event name for property ${propertyName} unknown`);
        this.fire(eventName, propertyValue);
    }

    _poolUpdated(newPool) {
        if (newPool === this._pool) return;
        const wasDisabled = !this._pool;
        this._pool = newPool;
        if (wasDisabled && newPool) this.fire('pool-enabled', newPool);
        if (!wasDisabled && !newPool) this.fire('pool-disabled');
        this.fire('pool-changed', newPool);
    }

    async _updateProperties(...propertyNames) {
        const rpcCalls = propertyNames.map(property => this._rpcClient.fetch(property));
        const propertyValues = await Promise.all(rpcCalls);
        for (let i = 0; i < propertyNames.length; ++i) {
            const propertyName = propertyNames[i], propertyValue = propertyValues[i];
            this._propertyUpdated(propertyName, propertyValue);
        }
    }
}
