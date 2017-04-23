class ConsensusP2PAgent {

    constructor(p2pClient) {
        p2pClient.on('inv', (msg, sender) => this._onInv(msg, sender));
        p2pClient.on('getdata', (msg, sender) => this._onGetData(msg, sender));
        p2pClient.on('notfound', (msg, sender) => this._onNotFound(msg, sender));
        p2pClient.on('block', (msg, sender) => this._onBlock(msg, sender));
    }

    _onInv(msg, sender) {
        // check which of the advertised objects we know
        // request unknown objects

        // XXX test: request all objects
        sender.getdata(msg.vectors);
    }

    _onGetData(msg, sender) {
        // check which of the requested objects we know
        // send back all known objects
        // send notfound for unknown objects


    }

    _onNotFound(msg, sender) {
        // TODO
    }

    _onBlock(msg, sender) {
        // verify block
        // put block into blockchain

    }

}
