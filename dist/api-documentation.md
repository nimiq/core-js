# nimiq API documentation

## Installation
Just include the nimiq library:
```<script src="nimiq.js"></script>``` 
## Usage 
Get an nimiq instance:
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
$.accounts.get('<<any address>>').then(balance => {
	console.log(balance.value)
	console.log(balance.nonce)
})
```

Query your wallet's balance:
```
$.wallet.getBalance($.accounts).then(balance => {
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

Listen for an Account's Balance change:
```
$.accounts.on('a09rjiARiVYh2zJS0/1pYKZg4/A=').then(balance => {
	console.log(balance)
})
```


Start Mining
```
$.miner.startWork();
```

Listen for peer connections:
```
$.network.on('peers-changed',() => console.log('Peers changed'));
$.network.on('peers-joined',() => console.log('Peer joined'));
$.network.on('peers-left',() => console.log('Peer left'));
```


## Syncing

```
let targetHeight = 0;
        $.consensus.on('syncing', _targetHeight => {
            targetHeight = _targetHeight;
        })

        $.blockchain.on('head-changed', _ => {
            const height = $.blockchain.height;
            ui.setProgress(height / targetHeight);
        })
```
