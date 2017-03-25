class BlockChains extends HasEvent{

  constructor(p2pDB) {
    super();
    this._chains = [new BlockChain()];
    this.maxChain = this._chains[0];
    this._p2pDB = p2pDB;
  }

  push(body) {
    // determine from header timestamp, if header is a "current" header
      // if so, it is a candidate for the next chain head
      // else 
        // continue catch-up phase 
        // chain fork 
        // orphan block 
    let nextHead = this.maxChain;
    let found = false;
    for (let chain of this._chains) {
      if (body.successorOf(chain.currHead)) {
        chain.push(body);
        found = true;
        if (chain.totalWork > nextHead.totalWork) {
          nextHead = chain;
        }
        // if(chain.totalWork === nextHead.totalWork)
        // 	// compare arrived timestamp
      }
    }
    if (!found) {
      return this._createFork(body);
    }
    if (nextHead !== this.maxChain) {
      return this._rebranch(this.maxChain, nextHead)
       .then( _ => this.fire(this.currHead));
    }
    this._p2pDB.accounts.commitBlock(body)
      .then( _ => this.fire(this.currHead));
    // this._p2pDB.blocks.get(body.txRoot)
  }

  async _createFork(block) {
    console.log('Fork BlockChain...');
    const prevTotalWork = this.maxChain.totalWork - this.maxChain.currHead.difficulty;	// Define here to prevent race condition
    const prevHead = await this._p2pDB.blocks.get(this.maxChain.prevId);
    if (block.successorOf(prevHead)) {
      this._chains.push(new BlockChain(block,prevTotalWork + block.difficulty));
    } else {
      block.header.log('Invalid Block');
    }
  }

  async _rebranch(newHead) {
    console.log('Rebranch BlockChain...');
    let oldHead = this.currHead;
    let newBranch = [newHead];
    while (!oldHead.successorOf(newBranch[0])) {
      await this._p2pDB.accounts.revertBlock(oldHead);
      oldHead = await this._p2pDB.blocks.get(newBranch[0].header.prevHash);
      newBranch.unshift(oldHead);
    }
    for (let block of newBranch) {
      await this._p2pDB.accounts.commitBlock(block);
    }
    this.maxChain = newHead;
  }

  get currHead() {
    return this.maxChain._currHead;
  }
}
