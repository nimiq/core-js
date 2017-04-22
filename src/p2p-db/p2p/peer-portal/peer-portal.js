// class PeerPortal extends HasEvent {

// 	constructor(){
// 		super();
// 		const wsUrl = localStorage.getItem('websocket');
// 		if(wsUrl){
// 			this._connectToWS(wsUrl);
// 		} else {
// 			this.connectToPortals();
// 		}
// 	}

// 	_connectToWS(wsUrl){
// 		const ws = new WebSocket(wsUrl);
// 		ws.onmessage = msg => {
// 			const reader = new FileReader();
// 			reader.onload = _ => {
// 				const offer = new WebrtcSession(JSON.parse(reader.result));
// 				WebrtcConnection.createAnswer(offer).then( answer => {
// 					ws.send(answer.serialized);
// 					answer.channel.then(channel => this.fire({ channel: channel, userId: offer.userId }));
// 				});
// 			}
// 			reader.readAsText(msg.data);
// 		}
// 		console.log('Connected to WebSocket PeerPortal',wsUrl)
// 	}

// 	connectToPortals(){
// 		const portals = ['https://i2.webp2p.robinlinus.com'];
// 		portals.forEach( portalUrl => this._connectToPortal(portalUrl));
// 	}

// 	_connectToPortal(portalUrl){
// 		WebrtcConnection.createOffer().then( offer => {
// 			console.log('Trying to connect to', portalUrl);
// 			fetch(portalUrl, { method: 'POST', body: offer.serialized })
// 				.then( resp => resp.json())
// 				.then( data => {
// 					const answer = new WebrtcSession(data);
// 					offer.channel.then(channel => this.fire({ channel: channel, userId: answer.userId }));
// 					offer.answered(answer);
// 				})
// 		});
// 	}
	
// 	static setWebSocket(ws){
// 		localStorage.setItem('websocket',ws);
// 	}
// }