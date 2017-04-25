// TODO: Implement Block Size Limit
// TODO V2: Implement total coins limit
class Policy{
	static get GENESIS_BLOCK(){
		return new RawBlockHeader(
			Buffer.fromBase64('tf2reNiUfqzIZL/uy00hAHgOWv4c2O+vsSSIeROsSfo'),
			Buffer.fromBase64('y3Pn0hMn3vWnuF05imj6l5AtJFc1fxpo39b0M2OKkaw'),
			Buffer.fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
			10,1486745275,77)
	}
	static get BLOCK_TIME(){return 10 /* in seconds */}
	static get BLOCK_REWARD(){return 1}
	static COINS_TO_LOVI(coins){return coins*1e8}
}
