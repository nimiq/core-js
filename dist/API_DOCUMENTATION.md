# Nimiq Core API documentation
**This documentation describes the API of the [Betanet](https://github.com/nimiq-network/core/tree/betanet) branch.**

All Nimiq Core classes reside in the `Nimiq.` namespace.

## Nimiq

### Basic initialization

```js
Nimiq.init($ => {
    // $ is the Nimiq.Core instance
});
```

### Initialization with error callback
- `Nimiq.ERR_WAIT`: An instance of Nimiq Core is already running in another window of the same origin. When all other windows are closed, the success callback will be invoked.
- `Nimiq.ERR_UNSUPPORTED`: This browser is not supported.
- `Nimiq.ERR_UNKNOWN`: An unknown error occured while loading.
- `Nimiq.Wallet.ERR_INVALID_WALLET_SEED` : An invalid wallet seed has been provided.

```js
Nimiq.init($ => {
    // $ is the Nimiq.Core instance
}, code => {
    switch (code) {
        case Nimiq.ERR_WAIT:
            alert('Another Nimiq instance is already running');
            break;
        case Nimiq.ERR_UNSUPPORTED:
            alert('Browser not supported');
            break;
        case Nimiq.Wallet.ERR_INVALID_WALLET_SEED:
            alert("Invalid wallet seed");
            break;
        default:
            alert('Nimiq initialization error');
            break;
    }
});
```

### Initialization with options
You can pass some options to initialization.  

| Option        | Description           |
| ------------- |:-------------:|
| **_walletSeed_** | Wallet seed (See [Nimiq.Wallet](#wallet)) |

```js
const options = {
  walletSeed: "d6a651dcc13dab2e9d05d..."
}

Nimiq.init($ => {
    // $ is the Nimiq.Core instance
}, code => {
  // Handle errors
},
  options
);
```

### Get an existing instance
```js
Nimiq.get().then($ => {
    // $ is the Nimiq.Core instance
});
```

## Nimiq.Core

### Properties
- `network`: [Nimiq.Network](#network)
- `consensus`: [Nimiq.Consensus](#consensus)
- `accounts`: [Nimiq.Accounts](#accounts)
- `blockchain`: [Nimiq.Blockchain](#blockchain)
- `mempool`: [Nimiq.Mempool](#mempool)
- `wallet`: [Nimiq.Wallet](#wallet)
- `miner`: [Nimiq.Miner](#miner)

### Methods
No public methods.

### Events
No events.


<a name="network"></a>
## Nimiq.Network
The network will not connect automatically, call `$.network.connect()` to do so.

### Properties
- `peerCount`
- `peerCountWebSocket`
- `peerCountWebRtc`
- `bytesReceived`
- `bytesSent`

### Methods
- `connect()`
- `disconnect()`

### Events
- `peers-changed`
- `peer-joined (peer)`
- `peer-left (peer)`

### Examples
Connect to the network:
```js
$.network.connect()
```

Listen for peer connections:
```js
$.network.on('peers-changed', () => console.log('Peers changed'));
$.network.on('peer-joined', peer => console.log(`Peer ${peer} joined`));
$.network.on('peer-left', peer => console.log(`Peer ${peer} left`));
```


<a name="consensus"></a>
## Nimiq.Consensus

### Properties
- `established`

### Methods
No public methods.

### Events
- `syncing (targetHeight)`
- `established`
- `lost`

### Examples
Listen for `established` event:
```js
$.consensus.on('established', () => console.log('consensus established!'))
```


<a name="accounts"></a>
## Nimiq.Accounts

### Properties
No public properties.

### Methods
- `getBalance(address)`
- `commitBlock(block)`
- `revertBlock(block)`
- `async hash()`

### Events
- `<<base64(address)>> (balance, address)` when balance of address changes.

### Examples
Query an account's balance:
```js
$.accounts.getBalance(<<address>>).then(balance => {
    console.log(balance.value)
    console.log(balance.nonce)
})
```
Listen for an account balance change:
```js
$.accounts.on('a09rjiARiVYh2zJS0/1pYKZg4/A=').then(balance => {
    console.log(balance)
})
```


<a name="blockchain"></a>
## Nimiq.Blockchain

### Properties
- `head`
- `headHash`
- `totalWork`
- `height`
- `path`
- `busy`

### Methods
- `pushBlock(block)`
- `getBlock(hash)`
- `getNextCompactTarget()`
- `async accountsHash()`

### Events
- `head-changed`
- `ready`

### Examples
Show the blockchain sync progress
```js
let targetHeight = 0;
$.consensus.on('syncing', _targetHeight => {
    targetHeight = _targetHeight;
})

$.blockchain.on('head-changed', () => {
    const height = $.blockchain.height;
    ui.setProgress(height / targetHeight);
})
```


<a name="mempool"></a>
## Nimiq.Mempool

### Properties
No public properties.

### Methods
- `pushTransaction(transaction)`
- `getTransaction(hash)`
- `getTransactions(maxCount = 5000)`

### Events
- `transaction-added`
- `transactions-ready`


<a name="wallet"></a>
## Nimiq.Wallet

### Properties
- `address`
- `publicKey`

### Methods
- `createTransaction(recipientAddr, value, fee, nonce)`
- `dump()`

### Events
No events.

### Examples
Create a transaction:
```js
$.wallet.createTransaction(recipientAddr, value, fee, nonce).then(transaction => {
    console.log(transaction)
})
```

Dump and restore wallet:  
```js
var walletSeed = $.wallet.dump();
var restoredWallet = await Wallet.load(walletSeed);
```

<a name="miner"></a>
## Nimiq.Miner
Mining should not start before consensus is established and stop when consensus is lost. The Miner does not explicitely enforce this, but callers should ensure this behavior.

```js
// Start mining automatically once consensus is (re-)established.
$.consensus.on('established', () => $.miner.startWork());

// Stop mining when consensus is lost. All clients should do this!
$.consensus.on('lost', () => $.miner.stopWork());
```

### Properties
- `working`
- `address`
- `hashrate`

### Methods
- `startWork()`
- `stopWork()`

### Events
- `start`
- `stop`
- `block-mined`
- `hashrate-changed`
