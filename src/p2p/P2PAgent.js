class ConsensusP2PAgent {

    constructor(blockchain, p2pChannel) {
        this._blockchain = blockchain;
        this._channel = p2pChannel;

        p2pChannel.on('inv', (msg, sender) => this._onInv(msg, sender));
        p2pChannel.on('getdata', (msg, sender) => this._onGetData(msg, sender));
        p2pChannel.on('notfound', (msg, sender) => this._onNotFound(msg, sender));
        p2pChannel.on('block', (msg, sender) => this._onBlock(msg, sender));

        // Notify peers when our blockchain head changes.
        // TODO Only do this if our local blockchain has caught up with the consensus height.
        blockchain.on('change', head => {
            console.log('Blockchain head has changed - announcing', head);
            InvVector.fromBlock(head)
                .then( vector => this._channel.inv([vector]));
        });
    }

    async _onInv(msg, sender) {
        // check which of the advertised objects we know
        // request unknown objects
        const unknownVectors = []
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[INV] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block, block);

                    // XXX Test
                    if (true || !block) {
                        // We don't know this block, save it in unknownVectors
                        // to request it later.
                        unknownVectors.push(vector);
                    } else {
                        // We already know this block, ignore it.
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    // TODO
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Request all unknown objects.
        if (unknownVectors.length) {
            sender.getdata(unknownVectors);
        }
    }

    async _onGetData(msg, sender) {
        // check which of the requested objects we know
        // send back all known objects
        // send notfound for unknown objects
        const unknownVectors = [];
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[GETDATA] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block, block);

                    if (block) {
                        // We have found a requested block, send it back to the sender.
                        sender.block(block);
                    } else {
                        // Requested block is unknown.
                        unknownVectors.push(vector);
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    // TODO
                    unknownVectors.push(vector);
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownVectors.length) {
            sender.notfound(unknownVectors);
        }
    }

    _onNotFound(msg, sender) {
        // TODO
    }

    _onBlock(msg, sender) {
        // verify block
        // put block into blockchain
        console.log('Received block, pushing into blockchain');
        this._blockchain.pushBlock(msg.block);
    }

}
