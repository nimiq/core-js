 // TODO: What if odd number of strings? 
 // TODO V2: work on BlockBody
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
