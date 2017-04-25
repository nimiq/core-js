const WebSocket = require('ws');
wss = new WebSocket.Server({ port: 8080 });
console.log('Signaling server listening...');

wss.channels = {};

function broadcast(conn, data) {
	wss.clients.forEach(function each(client) {
		if (client !== conn && client.readyState === WebSocket.OPEN) {
			client.send(data);
		}
    });
}

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

			//broadcast(conn, peerList([sender]));
		} else if (wss.channels[receiver]) {
			wss.channels[receiver].send(data);
		}
	});

	conn.on('close', e => {
		if (conn.peerId) {
			delete wss.channels[conn.peerId];
		}
	});
});
