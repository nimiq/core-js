class ConsensusP2PAgent {

    constructor(blockchain, p2pChannel) {
        this._blockchain = blockchain;
        this._channel = p2pChannel;

        p2pChannel.on('peer-joined', peer => this._onPeerJoined(peer));

        p2pChannel.on('version',    (msg, sender) => this._onVersion(msg, sender));
        p2pChannel.on('inv',        (msg, sender) => this._onInv(msg, sender));
        p2pChannel.on('getdata',    (msg, sender) => this._onGetData(msg, sender));
        p2pChannel.on('notfound',   (msg, sender) => this._onNotFound(msg, sender));
        p2pChannel.on('block',      (msg, sender) => this._onBlock(msg, sender));
        p2pChannel.on('getblocks',  (msg, sender) => this._onGetBlocks(msg, sender));

        // Notify peers when our blockchain head changes.
        // TODO Only do this if our local blockchain has caught up with the consensus height.
        blockchain.on('head-changed', head => {
            InvVector.fromBlock(head)
                .then( vector => this._channel.inv([vector]));
        });
    }

    async _onPeerJoined(peer) {
        // When a new peer connects, tell it our version.
        peer.version(this._blockchain.height);
    }

    async _onVersion(msg, sender) {
        // A new peer has told us his version.
        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Check if it claims to have a longer chain.
        if (this._blockchain.height < msg.startHeight) {
            console.log('Peer ' + sender.peerId + ' has longer chain (ours='
                + this._blockchain.height + ', theirs=' + msg.startHeight
                + '), requesting blocks');

            // Request blocks starting from our hardest chain head going back to
            // the genesis block. Space out blocks more when getting closer to the
            // genesis block.
            const hashes = [];
            let step = 1;
            for (let i = this._blockchain.height - 1; i > 0; i -= step) {
                // Push top 10 hashes first, then back off exponentially.
                if (hashes.length >= 10) {
                    step *= 2;
                }
                hashes.push(this._blockchain.path[i]);
            }

            // Push the genesis block hash.
            hashes.push(Block.GENESIS.HASH);

            // Request blocks from peer.
            sender.getblocks(hashes);
        }
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

                    if (!block) {
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

    async _onBlock(msg, sender) {
        // TODO verify block
        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64() + ', pushing into blockchain');

        // put block into blockchain
        await this._blockchain.pushBlock(msg.block);
    }

    async _onGetBlocks(msg, sender) {
        console.log('[GETBLOCKS] Request for blocks, ' + msg.hashes.length + ' block locators');

        // A peer has requested blocks. Check all requested block locator hashes
        // in the given order and pick the first hash that is found on our main
        // chain, ignore the rest. If none of the requested hashes is found,
        // pick the genesis block hash. Send the main chain starting from the
        // picked hash back to the peer.
        // TODO honor hashStop argument
        const mainPath = this._blockchain.path;
        let startIndex = -1;

        for (let hash of msg.hashes) {
            // Shortcut for genesis block which will be the only block sent by
            // fresh peers.
            if (Block.GENESIS.HASH.equals(hash)) {
                startIndex = 0;
                break;
            }

            // Check if we know the requested block.
            const block = await this._blockchain.getBlock(hash);

            // If we don't know the block, try the next one.
            if (!block) continue;

            // If the block is not on our main chain, try the next one.
            // The mainPath is an IndexedArray with constant-time .indexOf()
            startIndex = mainPath.lastIndexOf(hash);
            if (startIndex < 0) continue;

            // We found a block, ignore remaining block locator hashes.
            break;
        }

        // If we found none of the requested blocks on our main chain,
        // start with the genesis block.
        if (startIndex < 0) {
            // XXX Assert that the full path back to genesis is available in
            // blockchain.path. When the chain grows very long, it makes no
            // sense to keep the full path in memory.
            if (this._blockchain.path.length !== this._blockchain.height)
                throw 'Blockchain.path.length != Blockchain.height';

            startIndex = 0;
        }

        // Collect up to 500 inventory vectors for the blocks starting right
        // after the identified block on the main chain.
        const stopIndex = Math.min(mainPath.length - 1, startIndex + 500);
        const vectors = [];
        for (let i = startIndex; i <= stopIndex; ++i) {
            vectors.push(new InvVector(InvVector.Type.BLOCK, mainPath[i]));
        }

        // Send the vectors back to the requesting peer.
        sender.inv(vectors);
    }
}
