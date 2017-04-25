const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const clients = {};

wss.on('connection', function connection(ws) {
  // ws.send(JSON.stringify({usersCount:wss.clients.size}));
      // send list of connected peers
  ws.on('message', function incoming(data) {
    const message = JSON.parse(data);
    const receiver = message.receiver;

    if(message.type === 'register'){
      const sender = message.sender;
      clients[sender] = ws;
    } else if(clients[receiver]) {
      clients[receiver].send(data);
    }
  });

});
