# Nimiq Core API documentation

## Core

### Basic initialization
```
Core.init($ => {
	// $ is the instance
});
```

### Initialization with error callback
Currently, the error callback will only be called if an instance of core is already running in another window of the same origin. When all other windows are closed, the success callback will be called.
```
Core.init($ => {
	// $ is the instance
}, () => alert('Another nimiq instance is already running'));
```

### Get an existing core instance
```
Core.get().then($ => {
	// $ is the instance
});
```

## Network
Available via `$.network`.
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
```
$.network.connect()
```

Listen for peer connections:
```
$.network.on('peers-changed', () => console.log('Peers changed'));
$.network.on('peer-joined', peer => console.log(`Peer ${peer} joined`));
$.network.on('peer-left', peer => console.log(`Peer ${peer} left`));
```


## Consensus
Available via `$.consensus`.

### Properties
- `established`

### Methods
No public methods.

### Events
- `syncing (targetHeight)`
- `established`
- `lost`

### Examples
Listen for `consensusEstablished` event:
```
$.consensus.on('established', () => console.log('consensus established!'))
```



## Accounts
Available via `$.accounts`.

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
```
$.accounts.getBalance(<<address>>).then(balance => {
	console.log(balance.value)
	console.log(balance.nonce)
})
```
Listen for an account balance change:
```
$.accounts.on('a09rjiARiVYh2zJS0/1pYKZg4/A=').then(balance => {
	console.log(balance)
})
```



## Blockchain
Available via `$.blockchain`.

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
```
let targetHeight = 0;
$.consensus.on('syncing', _targetHeight => {
    targetHeight = _targetHeight;
})

$.blockchain.on('head-changed', () => {
    const height = $.blockchain.height;
    ui.setProgress(height / targetHeight);
})
```




## Mempool
Available via `$.mempool`.

### Properties
No public properties.

### Methods
- `pushTransaction(transaction)`
- `getTransaction(hash)`
- `getTransactions(maxCount = 5000)`

### Events
- `transaction-added`
- `transactions-ready`

### Examples
<TODO>



## Wallet
Available via `$.wallet`.

### Properties
- `address`
- `publicKey`

### Methods
- `createTransaction(recipientAddr, value, fee, nonce)`

### Events
No events.

### Examples
Create a transaction:
```
$.wallet.createTransaction(recipientAddr, value, fee, nonce).then(transaction => {
	console.log(transaction)
})
```


## Miner
Available via `$.miner`.

Mining should not start before consensus is established and stop when consensus is lost. The Miner does not explicitely enforce this, but callers should ensure this behavior.

```
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

### Examples
Start mining
```
$.miner.startWork();
```
