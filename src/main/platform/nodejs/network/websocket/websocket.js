const WebSocket = require('ws');
wss = new WebSocket.Server({ port: 8080 });
console.log('Signaling server listening ...');

wss.channels = {};

function peerList(peers) {
	return JSON.stringify({
		type: 'peerIds',
		payload: peers
	});
}

wss.on('connection', conn => {
	// Send peer list to connecting client
	conn.send(peerList(Object.keys(wss.channels)));

	conn.on('message', data => {
		const message = JSON.parse(data);
		const receiver = message.receiver;

		if (message.type === 'register') {
			const sender = message.sender;
			conn.peerId = sender;
			wss.channels[sender] = conn;

			console.log('Client ' + conn.peerId + ' registered | ' + Object.keys(wss.channels).length + ' clients total');
		} else if (wss.channels[receiver]) {
			try {
				wss.channels[receiver].send(data);
			} catch (e) {
				console.error('Error sending data to ' + receiver + ', closing channel');
				wss.channels[receiver].close();
			}
		}
	});

	conn.on('close', e => {
		if (conn.peerId) {
			delete wss.channels[conn.peerId];
		}
		console.log('Client ' + conn.peerId + ' disconnected | ' + Object.keys(wss.channels).length + ' clients total');
	});
});
