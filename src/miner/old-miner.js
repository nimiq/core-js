// // TODO: Implement transaction pool
// // TODO V2: Include queued transactions immediately
// // TODO V2: Parallel mining in WebWorkers

// Date.prototype.timeNow = function(){return ((this.getHours() < 10) ? '0' : '') + this.getHours() + ':' + ((this.getMinutes() < 10) ? '0' : '') + this.getMinutes() + ':' + ((this.getSeconds() < 10) ? '0' : '') + this.getSeconds();}

// class Miner{
//   constructor(p2pDBs, address) {
//     this._p2pDBs = p2pDBs;
//     this._address = address;
//     this._transactionsQueue = [];
//   }

//   queueTx(tx) {
//     this._transactionsQueue.push(tx);
//     tx.log('Queued Tx:');
//   }

//   workOnChain(prev) {
//     if (!prev) throw 'Prev must be a block';
//     if (this._worker) clearInterval(this._worker);
//     this._resetNonce();
//     this._currBody(prev).then(body => {
//       this._worker = setInterval(() => this._mineHeader(prev, body), 1);
//     });
//   }

//   _mineHeader(prev, body) {
//     const rawBlockHeader =  new RawBlockHeader(prev.id, body.txRoot, this._p2pDBs.accounts.stateRoot, this._currDifficulty(prev), this._currTime(),this._currNonce());		//TODO: alloc only once?
//     BlockHeader.create(rawBlockHeader).then(header => {
//       if (!header) return;
//       header.log(`Mining success: ${new Date().timeNow()} TXs: ${body.txLength} Time: ${this._currTime() - prev.timestamp}s`);
//       if (this._worker) clearInterval(this._worker);
//       this._p2pDBs.blocks.publish(new Block(header,body));
//     })
//      .catch(console.error);
//   }

//   _currBody(prev) {
//     if (this.__currBody) return this.__currBody;
//     const txs = this._transactionsQueue.slice(0);
//     this._transactionsQueue = [];
//     return new BlockBody(new RawBlockBody(this._address, txs));
//   }

//   _currTime() {
//     return Math.round(Date.now() / 1000);
//   }

//   _currDifficulty(prev) {
//     return (this._currTime() - prev.timestamp) > Policy.BLOCK_TIME ? prev.difficulty - 1 : prev.difficulty + 1;
//   }

//   _currNonce() {
//     this._nonce += 1;
//     return this._nonce;
//   }

//   _resetNonce() {
//     this._nonce = 0;
//   }

//   _genesis() {
//     BlockHeader.create(Policy.GENESIS_BLOCK).then(header => this.workOnChain(header));
//   }
// }

