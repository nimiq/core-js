"use strict";

importScripts('web-worker-deps.js');

var id,
    headHash,
    working = false,
    hashCount = 0,
    rateSender = null,
    hop = 1;
    // nimiqInitialized = false;

// Nimiq.init(instance => {
//     nimiqInitialized = true;
// });

async function _mine(block, buffer) {
    // Abort mining if the blockchain head changed.
    if (!headHash.equals(block.prevHash)) {
        return;
    }

    // Abort mining if the user stopped the miner.
    if (!working) {
        postMessage({event: 'miner-stopped', id});
        return;
    }

    // Reset the write position of the buffer before re-using it.
    buffer.writePos = 0;

    // Compute hash and check if it meets the proof of work condition.
    const isPoW = await block.header.verifyProofOfWork(buffer);

    // Keep track of how many hashes we have computed.
    hashCount++;

    // Check if we have found a block.
    if (isPoW) {
        // Tell listeners that we've mined a block.
        postMessage({event: 'block-mined', block: BufferUtils.toBase64(block.serialize()), id});
    } else {
        // Increment nonce.
        block.header.nonce += hop;

        // Continue mining.
        _mine(block, buffer);
    }
}

onmessage = function(e) {
    const data = e.data;
    switch(data.cmd) {
        case 'init-worker':
            id  = data.id;
            hop = data.hop;

            break;
        case 'start-mining': {
            // Make sure the worker has been initialized
            if(typeof id === "undefined") break;

            working  = true;
            headHash = Hash.unserialize(BufferUtils.fromBase64(data.headHash));

            if(!rateSender) {
                rateSender = setInterval(function() {
                    postMessage({event: 'hash-count', hashCount, id});
                    hashCount = 0;
                }, 1000);
            }

            let block = Block.unserialize(BufferUtils.fromBase64(data.block));
            let buffer = BufferUtils.fromBase64(data.buffer);

            // Let every worker start at a different nonce by increasing the starting nonce per worker
            block.header.nonce += id;

            _mine(block, buffer);

            break;
        }
        case 'stop-mining':
            working   = false;
            hashCount = 0;

            clearInterval(rateSender);
            rateSender = null;

            break;
        case 'terminate':
            close();
    }
};
