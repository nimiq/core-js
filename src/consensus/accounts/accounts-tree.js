// TODO: use firstchar of key as child index
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
