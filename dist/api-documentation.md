# Nimiq Core API documentation

## Installation
Just include the nimiq core library:
```<script src="dist/web.js"></script>```

## Usage 
Initialize nimiq core:
```
Core.init($ => {
	// $ is the instance
});
```

Initialize nimiq core (with error callback):
Currently, the error callback will only be called if an instance of core is already running in another window of the same origin. When all other windows are closed, the success callback will be called.
```
Core.init($ => {
	// $ is the instance
}, () => alert('Another nimiq instance is already running'));
```

Get an existing core instance:
```
Core.get().then($ => {
	// $ is the instance 
});
```

Connect to the network:
```
$.network.connect()
```

Listen for `consensusEstablished` event:
```
$.consensus.on('established', () => console.log('consensus established!'))
```

Query an account's balance:
```
$.accounts.getBalance(<<address>>).then(balance => {
	console.log(balance.value)
	console.log(balance.nonce)
})
```

Query your wallet's balance:
```
$.wallet.getBalance().then(balance => {
	console.log(balance.value)
	console.log(balance.nonce)
})
```

Create a transaction:
```
$.wallet.createTransaction(recipientAddr, value, fee, nonce).then(transaction => {
	console.log(transaction)
})
```

Listen for an account's balance change:
```
$.accounts.on('a09rjiARiVYh2zJS0/1pYKZg4/A=').then(balance => {
	console.log(balance)
})
```

Start mining
```
$.miner.startWork();
```

Listen for peer connections:
```
$.network.on('peers-changed', () => console.log('Peers changed'));
$.network.on('peer-joined', peer => console.log(`Peer ${peer} joined`));
$.network.on('peer-left', peer => console.log(`Peer ${peer} left`));
```


## Show the blockchain sync progress
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
