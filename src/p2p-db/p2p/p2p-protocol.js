const MESSAGES = {
	VERSION: 'version',
	VERACK: 'verack',
	ADDR: 'addr',
	INV: 'inv',
	GETDATA: 'getdata',
	NOTFOUND: 'notfound',
	GETBLOCKS: 'getblocks',
	GETHEADERS: 'getheaders',
	TX: 'tx',
	BLOCK: 'block',
	HEADERS: 'headers',
	GETADDR: 'getaddr',
	MEMPOOL: 'mempool',
	CHECKORDER: 'checkorder',
	SUBMIT: 'submitorder',
	REPLY: 'reply',
	PING: 'ping',
	PONG: 'pong',
	REJECT: 'reject',
	FILTERLOAD: 'filterload',
	FILTERADD: 'filteradd',
	FILTERCLEAR: 'filterclear',
	MERKLEBLOCK: 'merkleblock',
	ALERT: 'alert',
	SENDHEADERS: 'sendheaders',
	FEEFILTER: 'feefilter',
	SENDCMPCT: 'sendcmpct',
	CMPCTBLOCK: 'cmpctblock',
	GETBLOCKTXN: 'getblocktxn',
	BLOCKTXN: 'blocktxn'
}


const STATES = {

}

class Message{
	static create(magic,command,length,checksum,payload){

	}

	constructor(serialized){

	}

	get magic(){

	}

	get command(){

	}

	get length(){

	}

	get checksum(){

	}

	get payload(){

	}
}

class VersionMsg extends Message{
	static create(magic,command,length,checksum,payload){
		super.create(magic,command,length,checksum,payload);
	} 
}

class VerAckMsg extends Message{
	static create(){
		super.create(magic,command,length,checksum,payload);
	}
}

class PeerProtocol extends P2PNetwork {
	constructor(){
		super();
	}

	send(msg){

	}

	onMessage(msg){
		this['_on'+msg.type](msg);
	}

	_onVersion(msg){

	}

	_onVerAck(msg){

	}
}