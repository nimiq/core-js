class PeerPortal{

	static get url(){
		return 'http://capira.de/peer-portal/?me=user1';
	}

	constructor(){
		var source = new EventSource(PeerPortal.url);
		
		source.addEventListener('message', e => {
		   const msg = e.data;
		}, false);
	}

	postMessage(msg,recipient){
		fetch(`${PeerPortal.url}?msg=${msg}&recipient=${recipient}`);
	}
}

const peerPortal = new PeerPortal();