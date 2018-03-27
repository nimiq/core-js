class MessageFactory {
    /**
     * @param {SerialBuffer} buf
     * @returns {Message.Type}
     */
    static peekType(buf) {
        return Message.peekType(buf);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {Message}
     */
    static parse(buf) {
        const type = Message.peekType(buf);
        const clazz = MessageFactory.CLASSES[type];
        if (!clazz || !clazz.unserialize) throw new Error(`Invalid message type: ${type}`);
        return clazz.unserialize(buf);
    }
}
/**
 * @dict 
 * @type {object}
 */
MessageFactory.CLASSES = {};
MessageFactory.CLASSES[Message.Type.VERSION] = VersionMessage;
MessageFactory.CLASSES[Message.Type.INV] = InvMessage;
MessageFactory.CLASSES[Message.Type.GET_DATA] = GetDataMessage;
MessageFactory.CLASSES[Message.Type.GET_HEADER] = GetHeaderMessage;
MessageFactory.CLASSES[Message.Type.NOT_FOUND] = NotFoundMessage;
MessageFactory.CLASSES[Message.Type.BLOCK] = BlockMessage;
MessageFactory.CLASSES[Message.Type.HEADER] = HeaderMessage;
MessageFactory.CLASSES[Message.Type.TX] = TxMessage;
MessageFactory.CLASSES[Message.Type.GET_BLOCKS] = GetBlocksMessage;
MessageFactory.CLASSES[Message.Type.MEMPOOL] = MempoolMessage;
MessageFactory.CLASSES[Message.Type.REJECT] = RejectMessage;
MessageFactory.CLASSES[Message.Type.SUBSCRIBE] = SubscribeMessage;
MessageFactory.CLASSES[Message.Type.ADDR] = AddrMessage;
MessageFactory.CLASSES[Message.Type.GET_ADDR] = GetAddrMessage;
MessageFactory.CLASSES[Message.Type.PING] = PingMessage;
MessageFactory.CLASSES[Message.Type.PONG] = PongMessage;
MessageFactory.CLASSES[Message.Type.SIGNAL] = SignalMessage;
MessageFactory.CLASSES[Message.Type.GET_CHAIN_PROOF] = GetChainProofMessage;
MessageFactory.CLASSES[Message.Type.CHAIN_PROOF] = ChainProofMessage;
MessageFactory.CLASSES[Message.Type.GET_ACCOUNTS_PROOF] = GetAccountsProofMessage;
MessageFactory.CLASSES[Message.Type.ACCOUNTS_PROOF] = AccountsProofMessage;
MessageFactory.CLASSES[Message.Type.GET_ACCOUNTS_TREE_CHUNK] = GetAccountsTreeChunkMessage;
MessageFactory.CLASSES[Message.Type.ACCOUNTS_TREE_CHUNK] = AccountsTreeChunkMessage;
MessageFactory.CLASSES[Message.Type.GET_TRANSACTIONS_PROOF] = GetTransactionsProofMessage;
MessageFactory.CLASSES[Message.Type.TRANSACTIONS_PROOF] = TransactionsProofMessage;
MessageFactory.CLASSES[Message.Type.GET_TRANSACTION_RECEIPTS] = GetTransactionReceiptsMessage;
MessageFactory.CLASSES[Message.Type.TRANSACTION_RECEIPTS] = TransactionReceiptsMessage;
MessageFactory.CLASSES[Message.Type.GET_BLOCK_PROOF] = GetBlockProofMessage;
MessageFactory.CLASSES[Message.Type.BLOCK_PROOF] = BlockProofMessage;
MessageFactory.CLASSES[Message.Type.GET_HEAD] = GetHeadMessage;
MessageFactory.CLASSES[Message.Type.HEAD] = HeadMessage;
MessageFactory.CLASSES[Message.Type.VERACK] = VerAckMessage;
Class.register(MessageFactory);
