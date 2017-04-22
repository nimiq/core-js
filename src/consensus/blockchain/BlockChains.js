class BlockChains extends Observable {

    constructor() {
        super();
        this._chains = [new BlockChain()];
        this._hardestChain = this._chains[0];
    }

    push(block) {
        // determine from header timestamp, if header is a "current" header
          // if so, it is a candidate for the next chain head
          // else
            // continue catch-up phase
            // chain fork
            // orphan block
        let hardestChain = this._hardestChain;
        let found = false;

        for (let chain of this._chains) {
            if (block.isSuccessorOf(chain.head)) {
                chain.push(block);
                found = true;

                if (chain.totalWork > hardestHead.totalWork) {
                    hardestChain = chain;
                }

                // if(chain.totalWork === nextHead.totalWork)
                // 	// compare arrived timestamp
            }
        }

        if (!found) {
            return this._createFork(block);
        }
        if (hardestChain !== this._hardestChain) {
            return this._rebranch(hardestChain)
                .then( _ => this.fire(this.head));
        }

        this._p2pDB.accounts.commitBlock(body)
            .then( _ => this.fire(this.currHead));
        // this._p2pDB.blocks.get(body.txRoot)
    }

    async _createFork(block) {
        console.log('Forking BlockChain...');

        const prevTotalWork = this._hardestChain.totalWork - this._hardestChain.head.difficulty;	// Define here to prevent race condition
        const prevHead = await this._p2pDB.blocks.get(this._hardestChain.head.prevHash);

        if (block.isSuccessorOf(prevHead)) {
            this._chains.push(new BlockChain(block, prevTotalWork + block.difficulty));
        } else {
            block.header.log('Invalid Block');
        }
    }

    async _rebranch(newHead) {
        console.log('Rebranching BlockChain...');

        let oldHead = this._hardestChain.head;
        let newBranch = [newHead];
        while (!oldHead.isSuccessorOf(newBranch[0])) {
            await this._p2pDB.accounts.revertBlock(oldHead);
            oldHead = await this._p2pDB.blocks.get(newBranch[0].header.prevHash);
            newBranch.unshift(oldHead);
        }

        for (let block of newBranch) {
            await this._p2pDB.accounts.commitBlock(block);
        }

        this._hardestChain = newHead;
    }

    get hardestChain() {
        return this._hardestChain;
    }

    get head() {
        return this._hardestChain.head;
    }
}
