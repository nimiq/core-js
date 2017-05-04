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
Start Mining
```
$.miner.startWork();
```
