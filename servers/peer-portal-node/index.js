wss.channels = {};

wss.on('connection', function connection(ws) {
  const peerIds = {
        type: 'peerIds',
        list: Object.keys(wss.channels)
  };
  ws.send(JSON.stringify(peerIds));

  ws.on('message', function incoming(data) {
    const message = JSON.parse(data);
    const receiver = message.receiver;

    if(message.type === 'register'){
      const sender = message.sender;
      wss.channels[sender] = ws;
    } else if(wss.channels[receiver]) {
      wss.channels[receiver].send(data);
    }
  });

});