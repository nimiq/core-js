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
$.consensus.on('established' () => console.log('consesus established!'))
```

Query an account's balance:
```
$.accounts.get('<<any address>>').then(balance => {
	console.log(balance.value)
	console.log(balance.nonce)
})
```


Start Mining
```
$.miner.startWork();
```
