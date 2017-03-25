// TODO: Implement Block Size Limit 
// TODO V2: Implement total coins limit
class Policy{
	static get GENESIS_BLOCK(){
		return new RawBlockHeader(
			Buffer.fromBase64('tf2reNiUfqzIZL/uy00hAHgOWv4c2O+vsSSIeROsSfo'),
			Buffer.fromBase64('y3Pn0hMn3vWnuF05imj6l5AtJFc1fxpo39b0M2OKkaw'),
			Buffer.fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
			10,1486745275,77)
	}
	static get BLOCK_TIME(){return 10 /* in seconds */}
	static get BLOCK_REWARD(){return Policy.COINS_TO_LOVI(10)}
	static COINS_TO_LOVI(coins){return coins*1e8}
}// TODO: Implement transaction pool
// TODO V2: Include queued transactions immediately
// TODO V2: Parallel mining in WebWorkers

Date.prototype.timeNow = function(){return ((this.getHours() < 10) ? '0' : '') + this.getHours() + ':' + ((this.getMinutes() < 10) ? '0' : '') + this.getMinutes() + ':' + ((this.getSeconds() < 10) ? '0' : '') + this.getSeconds();}

class Miner{
  constructor(p2pDBs, address) {
    this._p2pDBs = p2pDBs;
    this._address = address;
    this._transactionsQueue = [];
  }

  queueTx(tx) {
    this._transactionsQueue.push(tx);
    tx.log('Queued Tx:');
  }

  workOnChain(prev) {
    if (!prev) throw 'Prev must be a block';
    if (this._worker) clearInterval(this._worker);
    this._resetNonce();
    this._currBody(prev).then(body => {
      this._worker = setInterval(() => this._mineHeader(prev, body), 1);
    });
  }

  _mineHeader(prev, body) {
    const rawBlockHeader =  new RawBlockHeader(prev.id, body.txRoot, this._p2pDBs.accounts.stateRoot, this._currDifficulty(prev), this._currTime(),this._currNonce());		//TODO: alloc only once?
    BlockHeader.create(rawBlockHeader).then(header => {
      if (!header) return;
      header.log(`Mining success: ${new Date().timeNow()} TXs: ${body.txLength} Time: ${this._currTime() - prev.timestamp}s`);
      if (this._worker) clearInterval(this._worker);
      this._p2pDBs.blocks.publish(new Block(header,body));
    })
     .catch(console.error);
  }

  _currBody(prev) {
    if (this.__currBody) return this.__currBody;
    const txs = this._transactionsQueue.slice(0);
    this._transactionsQueue = [];
    return new BlockBody(new RawBlockBody(this._address, txs));
  }

  _currTime() {
    return Math.round(Date.now() / 1000);
  }

  _currDifficulty(prev) {
    return (this._currTime() - prev.timestamp) > Policy.BLOCK_TIME ? prev.difficulty - 1 : prev.difficulty + 1;
  }

  _currNonce() {
    this._nonce += 1;
    return this._nonce;
  }

  _resetNonce() {
    this._nonce = 0;
  }

  _genesis() {
    BlockHeader.create(Policy.GENESIS_BLOCK).then(header => this.workOnChain(header));
  }
}

class Core {
  constructor() {
    const p2pDBs = new P2PDBs();
    p2pDBs.blockChains.onEvent(longestChain => this._miner.workOnChain(longestChain.header));
    p2pDBs.onEvent(tx => this._miner.queueTx(tx));
    this._P2PDBs = p2pDBs;

    Wallet.get(p2pDBs.accounts).then(wallet => {
      this.wallet = wallet;
      wallet.exportAddress().then(addr => {
        console.log('Your Address:', Buffer.toBase64(addr));
        this._miner = new Miner(p2pDBs, addr);
      });
    });
  }

  transfer(value, receiverAddr, fee) {
    this.wallet.createTx(value, receiverAddr, fee)
     .then(tx => {
      this._P2PDBs.publishTx(tx);
      this._miner.queueTx(tx);
    });
  }
}

const $ = new Core();
console.log('%cWelcome to \uD835\uDD43ovicash', 'font-size:24px; color:teal;');
console.log(
`Options:
  1: $._miner._genesis() 
  2: $.transfer(4000,'8wjPPNOW0EXl/I5KVAy6mNzo9a2ufj1l',55)
  3: PeerPortal.setWebSocket('ws://localhost:8000')
`);

window.addEventListener('unhandledrejection', event => {
      event.preventDefault();
      console.error(event.reason || event);
    });
class Primitive{
	constructor(serialized){
		this._buffer = serialized.buffer || serialized;
	}

	hash(){
		return Crypto.sha256(this._buffer);
	}

	serialize(){
		return this._buffer;
	}

	toBase64(){
		return Buffer.toBase64(this._buffer);
	}

	toString(){
		return this.toBase64();
	}

	view8(start, length){
		return new Uint8Array(this._buffer, start, length);
	}

	view32(start){
		return new Uint32Array(this._buffer, start, 1)[0] | 0;
	}

	log(desc, string){
		setTimeout( _ => console.debug(desc, string), 1);	// Async logging after current event loop
	}
}


// TODO V2: Transactions may contain a payment reference such that the chain can prove existence of data
// TODO V2: Copy 'serialized' to detach all outer references 
class RawTx extends ArrayBuffer {
    constructor(value, receiver, fee, nonce){
        super(Constants.TX_SIZE_RAW);
        const valueView = new Float64Array(this,0,1);
        valueView[0] = value;
        const view = new Uint32Array(this,8,2);
        view[0] = fee;
        view[1] = nonce;
        const view2 = new Uint8Array(this,16,Constants.ADDRESS_SIZE);
        view2.set(receiver,0,Constants.ADDRESS_SIZE);
    }
}

class Transaction extends Primitive {

    static create(rawTx, sender, signature){
        const buffer = new ArrayBuffer(Constants.TX_SIZE);
        const view = new Uint8Array(buffer);
        view.set(new Uint8Array(rawTx), 0);
        view.set(new Uint8Array(sender), Constants.TX_SIZE_RAW);
        view.set(new Uint8Array(signature), Constants.TX_SIZE_RAW + Constants.PUBLIC_KEY_SIZE);
        return new Transaction(buffer);
    }

    constructor(serialized){
        super(serialized);
        if(this.value <= 0 || this.value > Number.MAX_SAFE_INTEGER) throw 'Malformed Value';
        if(this.fee <= 0) throw 'Malformed Fee';
        if(this.nonce < 0) throw 'Malformed Nonce';
        Object.freeze(this);
        return Crypto.verify(this.sender, this.signature, this.rawTx)
            .then( success => { 
                if(!success) throw 'Malformed Signature';
                return this;
            });
    }

    get value(){
        return new Float64Array(this._buffer,0,1)[0];
    } 

    get fee(){
        return this.view32(8);
    }

    get nonce(){
        return this.view32(12);
    }

    get receiver(){
        return this.view8(16,Constants.ADDRESS_SIZE);
    }    

    get sender(){
        return this.view8(Constants.TX_SIZE_RAW,Constants.PUBLIC_KEY_SIZE);
    }

    senderAddr(){
        return Crypto.publicToAddress(this.sender);
    }

    get signature(){
        return this.view8(Constants.TX_SIZE_RAW+Constants.PUBLIC_KEY_SIZE,Constants.SIGNATURE_SIZE);
    }

    get rawTx(){
        return this.view8(0,Constants.TX_SIZE_RAW);
    }

    log(desc){
        this.senderAddr().then(addr => {
            super.log(desc,`Transaction:
            sender: ${Buffer.toBase64(addr)}
            receiver: ${Buffer.toBase64(this.receiver)} 
            signature: ${Buffer.toBase64(this.signature)} 
            value: ${this.value} fee: ${this.fee}, nonce: ${this.nonce}`);
        });
    }
}// TODO: use firstchar of key as child index
class AccountsTree {

  constructor(db) {
    this.db = db;
  }

  async put(key, value) {
    if (!this.rootNode) {
      this.rootNode = await this.db.put(['',false]);
    }
    let currNode = await this.db.get(this.rootNode);
    let parentNodes = [];
    let childIndex;
    let nodeKey;
    let nodeKeyLen;
    // traverse
    traverse: while (true) {
      nodeKey = currNode[0];
      nodeKeyLen = nodeKey.length;
      // Find common prefix
      let commonPrefix = '';
      let i = 0;
      for (; i < nodeKeyLen; ++i) {
        if (nodeKey[i] !== key[i]) break;
        commonPrefix += nodeKey[i];
      }

      key = key.slice(i);
      if (i !== nodeKeyLen) {
        await this.db.delete(currNode);
        currNode[0] = nodeKey.slice(i);
        const newCurrKey = await this.db.put(currNode);

        const newChild = [key,value];
        const newChildKey = await this.db.put(newChild);

        const newParent = [commonPrefix,'',newCurrKey,newChildKey];
        const newNodeKey = await this.db.put(newParent);

        return await this._traverseHome(newNodeKey, parentNodes);
      }

      if (!key.length) {
        await this.db.delete(currNode);
        currNode[1] = value;
        const newNodeKey = await this.db.put(currNode);
        return await this._traverseHome(newNodeKey, parentNodes);
      }

      //Find next node
      i = 2;
      for (; i < currNode.length; ++i) {
        let nextNode = await this.db.get(currNode[i]);
        if (nextNode[0][0] !== key[0]) continue;
        parentNodes.push([currNode,i]);
        currNode = nextNode;
        continue traverse;
      }

      const newChild = [key,value];
      const newChildKey = await this.db.put(newChild);
      await this.db.delete(currNode);
      currNode.push(newChildKey);
      const newNodeKey = await this.db.put(currNode);
      return await this._traverseHome(newNodeKey, parentNodes);
    }
  }

  async _traverseHome(newParentKey, parentNodes) {
    let j = parentNodes.length - 1;
    for (; j >= 0; --j) {
      const parentNode = parentNodes[j][0];
      const childIndex = parentNodes[j][1];
      await this.db.delete(parentNode);

      parentNode[childIndex] = newParentKey;
      newParentKey = await this.db.put(parentNode);
    }
    this.rootNode = newParentKey;
    return this.rootNode;
  }

  async get(key) {
    if (!this.rootNode) return;
    let currNode = await this.db.get(this.rootNode);

    traverse: while (true) {
      const nodeKey = currNode[0];

      // Find common prefix
      let commonPrefix = '';
      let i = 0;
      for (; i < nodeKey.length; ++i) {
        if (nodeKey[i] !== key[i]) break;
        commonPrefix += nodeKey[i];
      }
      key = key.slice(i);

      if (i !== nodeKey.length) return;

      if (key === '') {
        return currNode[1];
      }

      //Find next node
      i = 2;
      for (; i < currNode.length; ++i) {
        let nextNode = await this.db.get(currNode[i]);
        if (nextNode[0][0] !== key[0]) continue;
        currNode = nextNode;
        continue traverse;
      }

      return false;
    }
  }

  get root() {
    if (!this.rootNode)
        return new Uint8Array(new ArrayBuffer(32));
    return Buffer.fromBase64(this.rootNode);
  }
}
// TODO: verify balances and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class AccountsState{

  constructor(db) {
    this._db = new AccountsTree(db);
  }

  commitBlock(block) {
    if (!Buffer.equals(block.header.stateRoot, this.stateRoot)) throw 'stateRoot error';
    return this._execute(block, (a, b) => a + b);
  }

  revertBlock(block) {
    return this._execute(block, (a, b) => a - b);
  }

  _execute(block, operator) {
    return this._executeTransactions(block.body, operator)
        .then(_ => this._rewardMiner(block.body, operator));
  }

  _rewardMiner(body, op) {
    return body.transactions()
        .then(txs => txs.reduce((sum, tx) => sum + tx.fee, 0))  // Sum up transaction fees
        .then(txFees => this._updateAccount(body.miner, txFees + Policy.BLOCK_REWARD, op));
  }

  async _executeTransactions(body, op) {
    const txs = await body.transactions();
    for (let tx of txs) {
      await this._executeTransaction(tx, op);
    }
  }

  _executeTransaction(tx, op) {
    return this._updateSender(tx, op)
        .then(_ => this._updateReceiver(tx, op));
  }

  _updateSender(tx, op) {
    return tx.senderAddr()
        .then(addr => this._updateAccount(addr, -tx.value - tx.fee, op));
  }

  _updateReceiver(tx, op) {
    return this._updateAccount(tx.receiver, tx.value, op);
  }

  async _updateAccount(address, value, operator) {
    const addr = Buffer.toBase64(address);
    const account = await this.fetch(address);
    account.value = operator(account.value, value);
    if (account.value < 0) throw 'BalanceError!';
    if (value < 0) account.nonce = operator(account.nonce, 1);
    return this._db.put(addr, account);
  }

  fetch(address) {
    const addr = Buffer.toBase64(address);
    return this._db.get(addr).then(account => account ? account : {value: 0, nonce: 0});
  }

  get stateRoot() {
    return this._db.root;
  }
}
class MiniBlockChains extends ProofChains{

  constructor(p2pDB) {
    super();
  }

  push(block) {
    super.push(block.header);
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
class ProofChains extends HasEvent{

  constructor(p2pDB) {
    super();
    this._chains = [new ProofChain()];
    this.maxChain = this._chains[0];
    this._p2pDB = p2pDB;
  }

  push(header) {
    // determine from header timestamp, if header is a "current" header
      // if so, it is a candidate for the next chain head
      // else 
        // continue catch-up phase 
        // chain fork 
        // orphan block 

    let nextHead = this.maxChain;
    let found = false;
    for (let chain of this._chains) {
      if (header.successorOf(chain.currHead)) {
        chain.push(header);
        found = true;
        if (chain.totalWork > nextHead.totalWork) {
          nextHead = chain;
        }
        // if(chain.totalWork === nextHead.totalWork)
        //  // compare arrived timestamp
      }
    }
    if (!found) {
      return this._createFork(header);
    }
    if (nextHead !== this.maxChain) {
      return this._rebranch(this.maxChain, nextHead)
       .then(_ => this.fire(this.currHead));
    }
    this._p2pDB.accounts.commitBlock(header)
     .then(_ => this.fire(this.currHead));
  }

  _onHead(head){
    this.fire(this.currHead);
  }

  async _createFork(block) {
    console.log('Fork ProofChain...');
    const prevTotalWork = this.maxChain.totalWork - this.maxChain.currHead.difficulty;  // Define here to prevent race condition
    const prevHead = await this._p2pDB.blocks.get(this.maxChain.prevId);
    if (block.successorOf(prevHead)) {
      this._chains.push(new ProofChain(block,prevTotalWork + block.difficulty));
    } else {
      block.header.log('Invalid Block');
    }
  }

  async _rebranch(newHead) {
    console.log('Rebranch ProofChain...');
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
}class ProofChain{

  constructor(headHeader, totalWork) {
    this._currHead = headHeader || {id: Buffer.fromBase64('ABlo+sKsuWY1iwv9vZ/EQufEyzTlrDX79+E7HZo0OQg=')};
    this._totalWork = totalWork || 10;
  }

  push(nextHead) {
    if (nextHead.successorOf(this._currHead)) {
      this._currHead = nextHead;
      this._totalWork += nextHead.difficulty;
      this.timestamp = nextHead.timestamp;
    }
  }

  get currHead() {
    return this._currHead;
  }

  get totalWork() {
    return this._totalWork;
  }

  get prevId() {
    return this.currHead.prevHash;
  }
}
const Constants = {
	TX_SIZE_RAW : 48,
	ADDRESS_SIZE: 24,
	PUBLIC_KEY_SIZE: 91,
	SIGNATURE_SIZE: 64,
	B_HEADER: 112,
}

Constants.TX_SIZE=Constants.TX_SIZE_RAW+Constants.PUBLIC_KEY_SIZE+Constants.SIGNATURE_SIZE
class Block{
	constructor(header,body){
		if(!Buffer.equals(header.txRoot,body.txRoot)) throw 'txRoot error';
		this.header = header;
		this.body = body;
	}

	successorOf(block){
		return this.header.successorOf(block.header);
	}

	get difficulty(){
		return this.header.difficulty;
	}
} // TODO V2: work on BlockBody
 // TODO V2: Do it in-place
 // TODO V2: Do it without recursion
class TransactionsTree{		
	static computeRoot(strings){ 			
		const len = strings.length;
		if(len == 1){
			return Crypto.sha256(strings[0]._buffer || strings[0]);
		}
		const mid = Math.round(len / 2);
		const left = strings.slice(0,mid);				
		const right = strings.slice(mid);
		return Promise.all([ 
					TransactionsTree.computeRoot(left),		 
					TransactionsTree.computeRoot(right)
				])
			.then( hashes => Crypto.sha256(Buffer.concat(hashes[0],hashes[1])));	
	}

	static prove(strings, root){
		return TransactionsTree.computeRoot(strings)
			.then( treeRoot => (root === treeRoot) )
	}
}
class RawBlockBody{
	constructor(minerAddr,transactions){
		const buffer = new ArrayBuffer(Constants.ADDRESS_SIZE+transactions.length*Constants.TX_SIZE); 
		const view = new Uint8Array(buffer);
		view.set(new Uint8Array(minerAddr),0,Constants.ADDRESS_SIZE);
		transactions.forEach((t,i) => view.set(
			new Uint8Array(t.serialize()),
			Constants.ADDRESS_SIZE+i*Constants.TX_SIZE));
		return buffer;
	}
}

class BlockBody extends Primitive {
	constructor(rawBody){
		super(rawBody);
		return this._computeTxRoot();
	}

	_computeTxRoot(){
		return this.transactions()
			.then(txs => TransactionsTree.computeRoot([this.miner, ...txs])
			.then(root => {
				this.txRoot = new Uint8Array(root);
				return this;
			}))
	}

	transactions(){
		if(this._txs){
			return Promise.resolve(this._txs);
		}
		const len = this.txLength;
		const txPromises = [];
		for(let i=0; i<len; i++){
			txPromises.push(this._transaction(i));
		}
		return Promise.all(txPromises).then(txs => {
			this._txs = txs;
			return txs;
		});
	}

	_transaction(index){
		return new Transaction(this._buffer.slice(Constants.ADDRESS_SIZE+index*Constants.TX_SIZE,Constants.ADDRESS_SIZE+(1+index)*Constants.TX_SIZE));
	}

	get txLength(){
		return (this._buffer.byteLength-Constants.ADDRESS_SIZE)/Constants.TX_SIZE;
	} 

	get miner(){
		return this.view8(0,Constants.ADDRESS_SIZE);
	}

	log(desc){
        super.log(desc,`BlockBody
            tx-root: ${Buffer.toBase64(this.txRoot)}
            tx-count: ${this.txLength}`);
    }
}class RawBlockHeader extends ArrayBuffer{
    constructor(prevHash, txRoot, stateRoot, difficulty, timestamp, nonce) {
        super(Constants.B_HEADER);
        
        const hashes = new Uint8Array(this,0,96);
        hashes.set(prevHash,0,32);
        hashes.set(new Uint8Array(txRoot),32,32);
        hashes.set(new Uint8Array(stateRoot),64,32);

        const uint32 = new Uint32Array(this,96);
        uint32[0] = difficulty | 0;
        uint32[1] = timestamp | 0;
        uint32[2] = nonce | 0;
	}
}

class BlockHeader extends Primitive{

    static create(rawBlockHeader){
        return new BlockHeader(rawBlockHeader);
    }

	constructor(serialized){
		super(serialized);
		return this._proofOfWork().then( proof => proof?this:false);
	}

    _proofOfWork(){   // verify: trailingZeros(hash) == difficulty
        return this.hash().then(hash => {    
            const view = new Uint8Array(hash);
            const zeroBytes = Math.floor(this.difficulty / 8);
            for(let i = 0; i < zeroBytes; i++){
                if(view[i] !== 0) return false;
            }
            const zeroBits = this.difficulty % 8;
            if(zeroBits && view[zeroBytes] > Math.pow(2, 8 - zeroBits )) return false;
            this.id = view;
            return true;
        });
    }

    get prevHash(){
        return this.view8(0,32);
    }    

    get txRoot(){
        return this.view8(32,32);
    }

    get stateRoot(){
        return this.view8(64,32);
    }

    get difficulty(){
        return this.view32(96);
    }

    get timestamp(){
        return this.view32(100);
    }    

    get nonce(){
        return this.view32(104);
    }

    successorOf(header){
        // TODO: check if difficulty matches
        return Buffer.equals(header.id, this.prevHash);
    }

    log(desc){
        super.log(desc,`BlockHeader
            id: ${Buffer.toBase64(this.id)}
            prev: ${Buffer.toBase64(this.prevHash)}
            tx-root: ${Buffer.toBase64(this.txRoot)}
            state-root: ${Buffer.toBase64(this.stateRoot)}
            difficulty: ${this.difficulty}, timestamp: ${this.timestamp}, nonce: ${this.nonce}`);
    }

    static sort(a,b){
        const timestampA = new Uint32Array(a,100,1)[0];
        const timestampB = new Uint32Array(b,100,1)[0];
        return timestampA - timestampB;
    }
}class HashTimeLockContract{
	constructor(){
		this.state = {
			value: 0,
			diff: 0,
			hashLock: '',
			timeLock: 0,
			timeOut: 0
		}
	}

	sendFundsA(signA){
		
	}
}class BlockChains extends HasEvent{

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
class BlockChain{

  constructor(head, totalWork) {
    this._currHead = head || {header: {id: Buffer.fromBase64('ABlo+sKsuWY1iwv9vZ/EQufEyzTlrDX79+E7HZo0OQg=')}};
    this._totalWork = totalWork || 10;
  }

  push(block) {
    if (block.successorOf(this._currHead)) {
      this._currHead = block;
      this._totalWork += block.difficulty;
    }
    return this._totalWork;
  }

  get currHead() {
    return this._currHead;
  }

  get totalWork() {
    return this._totalWork;
  }

  get prevId() {
    return this.currHead.header.prevHash;
  }
}
// TODO: Implement persistent chain
// TODO: Implement resolving of forks
// TODO: Implement catch up
// TODO: Implement longest chain
// TODO V2: Implement light catch up

class BlocksP2PDB extends HasEvent {

  constructor(db, p2p) {
    super();
    this._headersCache = {};
    this._db = db;
    this._p2p = p2p;
  }

  processHeader(header) {
    header.log('Received');
    const txRoot = Buffer.toBase64(header.txRoot);
    this._headersCache[txRoot] = header;
  }

  processBody(body) {
    body.log('Received');
    const txRoot = Buffer.toBase64(body.txRoot);
    const header = this._headersCache[txRoot];
    if (header) {
      this._headersCache[txRoot] = null;
      this._db.bodies.save(body);
      this._db.headers.save(header);
      this.fire(new Block(header,body));
    }
  }

  publish(block) {
    this._db.headers.save(block.header);
    this._db.bodies.save(block.body);
    this._p2p.broadcast(block.header);
    this._p2p.broadcast(block.body);
    this.fire(block);
  }

  get(id) {
    return this._db.headers.load(id)
     .then(header => this._db.bodies.load(header.txRoot)
      .then(body => new Block(header,body)));
  }

  getHeader(id) {
    return this._db.headers.load(id);
  }

  sendAllHeadersTo(peerId) {
    this._db.headers.getAll()
     .then(headers => headers
      .sort(BlockHeader.sort)
      .forEach(header => this._p2p.sendTo(peerId, header)));
  }
}

class AccountsP2PDB extends RawIndexedDB {
  constructor() {
    super('accounts');
  }

  _serialize(node) {return Crypto.sha256(Buffer.fromUnicode(JSON.stringify(node)));}

  put(node) {
    return this._serialize(node).then(hash => {
              const base64 = Buffer.toBase64(hash);
              super.put(base64, node);
              return base64;
            });
  }

  delete (node) {
    return this._serialize(node).then(hash => super.delete(Buffer.toBase64(hash)));
  }

  get(key) {
    return super.get(key);
  }
}

class P2PDBs extends HasEvent{
  constructor() {
    super();
    this._p2p = new P2PNetwork();
    this._db = new Databases();

    this.accounts = new AccountsState(new AccountsP2PDB());
    this.blockChains = new BlockChains(this);
    // this.proofChains = new ProofChains(this);

    this.blocks = new BlocksP2PDB(this._db, this._p2p);
    this.blocks.onEvent(block => this.blockChains.push(block));

    this._p2p.onEvent(obj => this._onObject(obj));
  }

  publishTx(tx) {
    this._p2p.broadcast(tx);
  }

  _onObject(obj) {
    if (obj.byteLength === Constants.B_HEADER)
     return new BlockHeader(obj).then(h => this.blocks.processHeader(h));
     // return new BlockHeader(obj).then(h => this.blockChains.push(h));
    if (obj.byteLength === Constants.TX_SIZE)
     return new Transaction(obj).then(tx => this.fire(tx));
    if (obj.byteLength % Constants.TX_SIZE === Constants.ADDRESS_SIZE)
     return new BlockBody(obj).then(b => this.blocks.processBody(b));
  }
}
class WebrtcConnection{

	static createConnection(){
		return WebrtcCertificate.get().then(cert => new RTCPeerConnection({
			iceServers: [
		        { urls: 'stun:stun.services.mozilla.com' },
		        { urls: 'stun:stun.l.google.com:19302' }
		    ],
		    certificates:[cert]
		}));
	}

	static createOffer(){
		return WebrtcConnection.createConnection()
			.then(conn => new Promise((resolve,error) => {
				const channel = conn.createDataChannel('data-channel');
		    	channel.binaryType = 'arraybuffer';
				conn.channel = new Promise((resolve,errror) => {
		        	channel.onopen = e => resolve(e.target);			
				});									
		        conn.createOffer().then( desc => conn.setLocalDescription(desc)
			        	.then( _ => conn.answered = session => { 
			        		conn.setRemoteDescription(session);
			        	}));
				conn.onicecandidate = e => {
					if(e.target.iceGatheringState !== 'complete') return;
					conn.serialized = WebrtcSession.serialize(conn);
					resolve(conn);
				};
			}));
	}

	static createAnswer(sessionDesc){
		return WebrtcConnection.createConnection()
			.then(conn => new Promise((resolve,error) => {
				conn.channel = new Promise((resolve,error) => {
			    	conn.ondatachannel = e => resolve(e.channel);			
				});
				if(sessionDesc.type !== 'offer') return;
				conn.setRemoteDescription(sessionDesc).then( _ => conn.createAnswer()
							.then( answer => conn.setLocalDescription(answer)));
				conn.onicecandidate = e => {
					if(e.target.iceGatheringState !== 'complete')return;
					conn.serialized = WebrtcSession.serialize(conn);
					resolve(conn);	
				};
			}));
	}
}

class WebrtcSession extends RTCSessionDescription{
	constructor(serialized){
		super(serialized);
	}

	get sessionId(){
		return this.sdp.match(/udp ([0-9]*)/g);
	}

	get userId(){
		return this.sdp 								// get session description
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g,'') 							// replace colons 
			.slice(1,32); 								// truncate hash to 16 bytes  
	}
	
	log(logDesc){
		console.log(logDesc,this.type,'\nsessionId:',this.sessionId,'\nuserId:',this.userId);
	}

	static serialize(conn){
		return JSON.stringify(conn.localDescription.toJSON());
	}
}
// TODO V2: should be a singleton
// TODO V2: should cache the certificate in it's scope
window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
class WebrtcCertificate {
	static get(){
		const db = new RawIndexedDB('certificate');
		return db.get('certKey').then(value =>{
			if(value) return value;
			return RTCPeerConnection.generateCertificate({
		  			name: 'ECDSA',
			    	namedCurve: 'P-256'
				})
				.then(cert => {
					db.put('certKey',cert);
					return cert;
				});
			});
	}
}

// TODO: Implement get and answerToGet
class P2PNetwork extends HasEvent {

  constructor() {
    super();
    const portal = new PeerPortal();
    this.peerChannels = {};
    portal.onEvent(peer => this._addPeer(peer));
  }

  _addPeer(peer) {
    const channel = peer.channel;
    console.log('peer added', peer.userId);
    this.peerChannels[peer.userId] = channel;
    channel.onmessage = m => this.fire(m.data);
    channel.onclose = _ => this._removePeer(peer.userId);
    channel.onerror = _ => this._removePeer(peer.userId);
  }

  _removePeer(userId) {
    console.log('disconnected', userId);
    delete this.peerChannels[userId];
  }

  broadcast(msg) {
    for (let key in this.peerChannels)
     this.peerChannels[key].send(msg._buffer);
  }

  sendTo(peerId, msg) {
    console.log('sendTo', peerId, msg);
    this.peerChannels[peerId].send(msg._buffer || msg);
  }
}
const MESSAGES = {
	VERSION: 'version',
	VERACK: 'verack',
	ADDR: 'addr',
	INV: 'inv',
	GETDATA: 'getdata',
	NOTFOUND: 'notfound',
	GETBLOCKS: 'getblocks',
	GETHEADERS: 'getheaders',
	TX: 'tx',
	BLOCK: 'block',
	HEADERS: 'headers',
	GETADDR: 'getaddr',
	MEMPOOL: 'mempool',
	CHECKORDER: 'checkorder',
	SUBMIT: 'submitorder',
	REPLY: 'reply',
	PING: 'ping',
	PONG: 'pong',
	REJECT: 'reject',
	FILTERLOAD: 'filterload',
	FILTERADD: 'filteradd',
	FILTERCLEAR: 'filterclear',
	MERKLEBLOCK: 'merkleblock',
	ALERT: 'alert',
	SENDHEADERS: 'sendheaders',
	FEEFILTER: 'feefilter',
	SENDCMPCT: 'sendcmpct',
	CMPCTBLOCK: 'cmpctblock',
	GETBLOCKTXN: 'getblocktxn',
	BLOCKTXN: 'blocktxn'
}


const STATES = {

}

class Message{
	static create(magic,command,length,checksum,payload){

	}

	constructor(serialized){

	}

	get magic(){

	}

	get command(){

	}

	get length(){

	}

	get checksum(){

	}

	get payload(){

	}
}

class VersionMsg extends Message{
	static create(magic,command,length,checksum,payload){
		super.create(magic,command,length,checksum,payload);
	} 
}

class VerAckMsg extends Message{
	static create(){
		super.create(magic,command,length,checksum,payload);
	}
}

class PeerProtocol extends P2PNetwork {
	constructor(){
		super();
	}

	send(msg){

	}

	onMessage(msg){
		this['_on'+msg.type](msg);
	}

	_onVersion(msg){

	}

	_onVerAck(msg){

	}
}class PeerPortal extends HasEvent {

	constructor(){
		super();
		const wsUrl = localStorage.getItem('websocket');
		if(wsUrl){
			this._connectToWS(wsUrl);
		} else {
			this.connectToPortals();
		}
	}

	_connectToWS(wsUrl){
		const ws = new WebSocket(wsUrl);
		ws.onmessage = msg => {
			const reader = new FileReader();
			reader.onload = _ => {
				const offer = new WebrtcSession(JSON.parse(reader.result));
				WebrtcConnection.createAnswer(offer).then( answer => {
					ws.send(answer.serialized);
					answer.channel.then(channel => this.fire({ channel: channel, userId: offer.userId }));
				});
			}
			reader.readAsText(msg.data);
		}
		console.log('Connected to WebSocket PeerPortal',wsUrl)
	}

	connectToPortals(){
		const portals = ['https://i2.webp2p.robinlinus.com'];
		portals.forEach( portalUrl => this._connectToPortal(portalUrl));
	}

	_connectToPortal(portalUrl){
		WebrtcConnection.createOffer().then( offer => {
			console.log('Trying to connect to', portalUrl);
			fetch(portalUrl, { method: 'POST', body: offer.serialized })
				.then( resp => resp.json())
				.then( data => {
					const answer = new WebrtcSession(data);
					offer.channel.then(channel => this.fire({ channel: channel, userId: answer.userId }));
					offer.answered(answer);
				})
		});
	}
	
	static setWebSocket(ws){
		localStorage.setItem('websocket',ws);
	}
}class ObjectDB extends IndexedDB {
  constructor(tableName, type) {
    super(tableName);
    this._type = type;
  }

  load(key) {
    return super.get(key).then(value => new this._type(value));
  }

  save(obj) {
    return obj.hash().then(key => super.put(key, obj.serialize()));
  }
}

class BlockHeaderDB extends ObjectDB {constructor() {super('headers', BlockHeader);}}

class BlockBodyDB 	extends ObjectDB {constructor() {super('bodies', BlockBody);}}

class Databases{
  constructor() {
    this.headers = new BlockHeaderDB();
    this.bodies = new BlockBodyDB();
  }
}
// TODO V2: Store private key encrypted
class Wallet{

	static get(accounts){
		const db = new RawIndexedDB('wallet');
		return db.get('keys').then(value => {
			if(value) return new Wallet(accounts,value);
			return Crypto.generateKeys()
				.then(keys => db.put('keys',keys)
					.then( _ => new Wallet(accounts,keys)));
		});
	}
	
	constructor(accounts, keys){
		this._accounts = accounts;
		this.keys = keys;
	}

	importPrivate(privateKey){
		return Crypto.importPrivate(privateKey)
	}

	exportPrivate(){
		return Crypto.exportPrivate(this.keys.privateKey)
			.then( buffer => Buffer.toHex(buffer));
	}

	exportPublic(){
		return Crypto.exportPublic(this.keys.publicKey);
	}

	exportAddress(){
		return Crypto.exportAddress(this.keys.publicKey);
	}

	_signTx(rawTx, publicKey){
		return Crypto.sign(this.keys.privateKey, rawTx)
			.then(signature => Transaction.create(rawTx, publicKey, signature));
	}

	_getAccount(){
		return this.exportAddress()
			.then(addr => this._accounts.fetch(addr));
	}

	createTx(value, receiverAddr, fee){
		return this.exportPublic()
			.then(publicKey => this._getAccount()
				.then(acc => {
					if( acc.value < value + fee ) throw 'Insufficient funds';
					const rawTx = new RawTx(value, Buffer.fromBase64(receiverAddr), fee, acc.nonce);
					return this._signTx(rawTx, publicKey);
				}));
	}
}

document.addEventListener("DOMContentLoaded", _ => {
	const pathFrags = location.pathname.split('/');
	let title = pathFrags[pathFrags.length-2];
	if(pathFrags[pathFrags.length-1].indexOf('.html')!==-1)
		title += ': '+pathFrags[pathFrags.length-1].replace('.html','')
	document.title = title;
	const el = document.createElement('div');
	el.innerHTML = 
		`<style>
			body{
				padding: 5% 12%;
				background: teal;
				color: white;
				font-family: sans-serif;
			}
		</style>
		<h4>test suite</h4>
		<h1><i>${title}</i></h1>`;
	document.body.appendChild(el);
});
class Buffer{

  static toUnicode(buffer, encoding = 'utf-8') {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  }

  static fromUnicode(string, encoding = 'utf-8') {
    const encoder = new TextEncoder(encoding);
    return encoder.encode(string);
  }

  static toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  static fromBase64(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  static toBase64Clean(buffer) {
    return Buffer.toBase64(buffer).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
  }

  static concatTypedArrays(a, b) {
    const c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  }

  static concat(a, b)  {
    return Buffer.concatTypedArrays(
        new Uint8Array(a.buffer || a),
        new Uint8Array(b.buffer || b)
    ).buffer;
  }

  static equals(a, b) {
    if (a.length !== b.length) return false;
    const viewA = new Uint8Array(a);
    const viewB = new Uint8Array(b);
    for (let i = 0; i < a.length; i++) {
      if (viewA[i] !== viewB[i]) return false;
    }
    return true;
  }
}
// TODO V2: Implement checksum for addresses
class Crypto {
  static get lib() { return window.crypto.subtle; }

  static get settings() {
    const hashAlgo = {name: 'SHA-256'};
    const signAlgo = 'ECDSA';
    const curve = 'P-256';    // can be 'P-256', 'P-384', or 'P-521'
    return {
        hashAlgo: hashAlgo,
        curve: curve,
        keys: {name: signAlgo, namedCurve: curve},
        sign: {name: signAlgo, hash: hashAlgo}
      };
  }

  static sha256(buffer) {
    return Crypto.lib.digest(Crypto.settings.hashAlgo, buffer);
  }

  static generateKeys() {
    return Crypto.lib.generateKey(Crypto.settings.keys, true, ['sign', 'verify']);
  }

  static exportPrivate(privateKey) {
    return Crypto.lib.exportKey('pkcs8', privateKey);
  }

  static importPrivate(privateKey) {
    return Crypto.lib.importKey('pkcs8', privateKey);
  }

  static exportPublic(publicKey, format ='spki') {
    return Crypto.lib.exportKey(format, publicKey);
  }

  static exportAddress(publicKey) {
    return Crypto.exportPublic(publicKey).then(Crypto.publicToAddress);
  }

  static importPublic(publicKey) {
    return Crypto.lib.importKey('spki', publicKey, Crypto.settings.keys, true, ['verify']);
  }

  static publicToAddress(publicKey) {
    return Crypto.sha256(publicKey).then(hash => hash.slice(0, 24));
  }

  static sign(privateKey, data) {
    return Crypto.lib.sign(Crypto.settings.sign, privateKey, data);
  }

  static verify(publicKey, signature, data) {
    return Crypto.importPublic(publicKey)
        .then(key => Crypto.lib.verify(Crypto.settings.sign, key, signature, data));
  }
}
class HasEvents {
  constructor() {
    this._callbacks = {};
  }
  onEvent(type, cb) {
    this._callbacks[type] = cb;
  }

  fire(type, obj) {
    if (this._callbacks[type])
      this._callbacks[type](obj);
  }
}

class HasEvent {
  onEvent(cb) {
    this._onEvent = cb;
  }

  fire(s) {
    if (this._onEvent)
      this._onEvent(s);
  }
}
navigator.storage.persisted().then(persistent=> {
  if (persistent)
    console.log('Storage will not be cleared except by explicit user action');
  else
    console.log('Storage may be cleared by the UA under storage pressure.');
});

// TODO: Make use of "storage-persistence" api (mandatory for private key storage)
// TODO V2: Make use of "IDBTransactions" api for serial reads/writes
class RawIndexedDB {

  static get db() {
    const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
    const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
    const dbVersion = 1;
    const request = indexedDB.open('lovicash', dbVersion);

    return new Promise((resolve,error) => {
        request.onsuccess = event => {
            resolve(request.result);
          };

        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore('headers');
            db.createObjectStore('bodies');
            db.createObjectStore('certificate');
            db.createObjectStore('accounts');
            db.createObjectStore('wallet');
          };
      });
  }

  constructor(tableName) {
    this.tableName = tableName;
  }

  put(key, value) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const putTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .put(value, key);
            putTx.onsuccess = event => resolve(event.target.result);
            putTx.onerror = error;
          }));
  }

  get(key) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const getTx = db.transaction([this.tableName])
                .objectStore(this.tableName)
                .get(key);
            getTx.onsuccess = event => resolve(event.target.result);
            getTx.onerror = error;
          }));
  }

  delete(key) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const deleteTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .delete(key);
            deleteTx.onsuccess = event => resolve(event.target.result);
            deleteTx.onerror = error;
          }));
  }

  getAll() {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const getAllTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .getAll();
            getAllTx.onsuccess = event => resolve(event.target.result);
            getAllTx.onerror = error;
          }));
  }
}

class IndexedDB extends RawIndexedDB {
  constructor(tableName) {super(tableName);}
  put(key, value) {return super.put(IndexedDB.serializeKey(key), value);}
  get(key) {return super.get(IndexedDB.serializeKey(key));}
  delete(key) {return super.delete(IndexedDB.serializeKey(key));}

  static serializeKey(key) { return Buffer.toBase64(key); }
}
