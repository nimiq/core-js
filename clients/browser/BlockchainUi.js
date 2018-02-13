class BlockchainUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;
        this._blockInterlinkCollapsed = true;
        this._blockTransactionsCollapsed = true;

        this.$title = this.$el.querySelector('[title]');

        this.$chainHeight = this.$el.querySelector('[chain-height]');
        this.$totalDifficulty = this.$el.querySelector('[total-difficulty]');
        this.$totalWork = this.$el.querySelector('[total-work]');
        this.$averageBlockTime = this.$el.querySelector('[average-block-time]');
        this.$lastBlockTime = this.$el.querySelector('[last-block-time]');

        this.$blockInfo = this.$el.querySelector('[block-info]');
        this.$blockNotFound = this.$el.querySelector('[block-not-found]');
        this.$blockHeightInput = this.$el.querySelector('[block-height-input]');
        this.$blockHash = this.$el.querySelector('[block-hash]');
        this.$blockPowHash = this.$el.querySelector('[block-pow-hash]');
        this.$blockPrevHash = this.$el.querySelector('[block-prev-hash]');
        this.$blockAccountsHash = this.$el.querySelector('[block-accounts-hash]');
        this.$blockDifficulty = this.$el.querySelector('[block-difficulty]');
        this.$blockTimestamp = this.$el.querySelector('[block-timestamp]');
        this.$blockNonce = this.$el.querySelector('[block-nonce]');
        this.$blockInterlink = this.$el.querySelector('[block-interlink]');
        this.$blockInterlinkTitle = this.$el.querySelector('[block-interlink-title]');
        this.$blockTransactions = this.$el.querySelector('[block-transactions]');
        this.$blockTransactionsTitle = this.$el.querySelector('[block-transactions-title]');
        this.$blockTransactionsCount = this.$el.querySelector('[block-transactions-count]');

        $.blockchain.on('head-changed', head => this._headChanged(head));
        $.consensus.on('established', () => this._headChanged($.blockchain.head));

        this._headChanged($.blockchain.head);
        const inputEventName = $.clientType === DevUi.ClientType.NANO? 'change' : 'input';
        this.$blockHeightInput.addEventListener(inputEventName, () => this._updateUserRequestedBlock());
        this.$blockInterlinkTitle.addEventListener('click', () => this._toggleBlockInterlink());
        this.$blockTransactionsTitle.addEventListener('click', () => this._toggleTransactions());

        $.consensus.on('syncing', () => this.$title.classList.add('syncing'));
        $.consensus.on('sync-chain-proof', () => this.$title.classList.add('sync-chain-proof'));
        $.consensus.on('verify-chain-proof', () => this.$title.classList.add('verify-chain-proof'));
        $.consensus.on('sync-accounts-tree', () => this.$title.classList.add('sync-accounts-tree'));
        $.consensus.on('verify-accounts-tree', () => this.$title.classList.add('verify-accounts-tree'));
        $.consensus.on('established', () => this.$title.classList.add('consensus-established'));
        $.consensus.on('lost', () => this.$title.classList.remove('initializing', 'connecting', 'syncing',
            'sync-chain-proof', 'verify-chain-proof', 'sync-accounts-tree', 'verify-accounts-tree',
            'consensus-established'));

        this.$title.classList.add('connecting');
    }

    _headChanged(head) {
        this.$chainHeight.textContent = this.$.blockchain.height;
        this.$blockHeightInput.placeholder = this.$.blockchain.height;
        this._updateAverageBlockTime();

        if (this.$.clientType !== DevUi.ClientType.NANO) {
            this.$totalDifficulty.textContent = this.$.blockchain.totalDifficulty;
            this.$totalWork.textContent = this.$.blockchain.totalWork;
        }

        if (this.$blockHeightInput.value === '') this._showBlockInfo(head);
    }

    _updateAverageBlockTime() {
        const head = this.$.blockchain.head;
        const tailHeight = Math.max(head.height - Nimiq.Policy.DIFFICULTY_BLOCK_WINDOW, 1);

        this.$.blockchain.getBlockAt(tailHeight).then(tailBlock => {
            let averageBlockTime;
            if (tailBlock) {
                averageBlockTime =
                    (head.timestamp - tailBlock.timestamp) / (Math.max(head.height - tailBlock.height, 1));
            } else {
                averageBlockTime = 'unknown';
            }
            this.$averageBlockTime.textContent = averageBlockTime + 's';
        });

        this.$.blockchain.getBlock(head.prevHash).then(prevBlock => {
            this.$lastBlockTime.textContent = (prevBlock ? (head.timestamp - prevBlock.timestamp) : 0) + 's';
        });
    }

    _showBlockInfo(block) {
        if (!block) {
            this.$blockInfo.style.display = 'none';
            this.$blockNotFound.style.display = 'block';
            return;
        }
        this.$blockInfo.style.display = 'block';
        this.$blockNotFound.style.display = 'none';

        this.$blockHash.textContent = block.hash().toBase64();
        this.$blockPrevHash.textContent = block.prevHash.toBase64();
        this.$blockAccountsHash.textContent = block.accountsHash.toBase64();
        this.$blockTimestamp.textContent = new Date(block.timestamp * 1000);
        this.$blockNonce.textContent = block.nonce;
        this.$blockTransactionsCount.textContent = !block.isLight()? block.transactionCount : '';

        block.pow().then(pow => {
            const realDifficulty = Nimiq.BlockUtils.realDifficulty(pow);
            this.$blockPowHash.textContent = pow.toBase64();
            this.$blockDifficulty.textContent = `${block.difficulty} (${realDifficulty})`;
        });

        if (!this._blockInterlinkCollapsed) {
            const interlink = `<hash>${block.interlink.hashes.map((it, i) => i + ':' + it.toBase64()).join('</hash><br><hash>')}</hash>`;
            this.$blockInterlink.innerHTML = interlink;
        }

        if (!this._blockTransactionsCollapsed) {
            this._updateBlocktransactions(block);
        }
    }

    _updateBlocktransactions(block) {
        if (block.isLight()) {
            this.$blockTransactions.textContent = 'No transaction info available for light block.';
            return;
        }
        if (block.transactions.length === 0) {
            this.$blockTransactions.textContent = 'No transactions.';
            return;
        }

        const transactions = block.transactions.map(tx => {
            const value = Utils.satoshisToCoins(tx.value);
            const fee = Utils.satoshisToCoins(tx.fee);
            return `<div>&nbsp;-&gt; from=${tx.sender.toUserFriendlyAddress()}, to=${tx.recipient.toUserFriendlyAddress()}, value=${value}, fee=${fee}, validityStart=${tx.validityStartHeight}</div>`;
        });

        this.$blockTransactions.innerHTML = transactions.join('');
    }

    _updateUserRequestedBlock() {
        if (this.$blockHeightInput.value === '') {
            this._showBlockInfo(this.$.blockchain.head);
            return;
        }
        const blockHeight = parseInt(this.$blockHeightInput.value);
        this.$.blockchain.getBlockAt(blockHeight).then(block => {
            if (parseInt(this.$blockHeightInput.value) !== blockHeight) return; // user changed value again
            this._showBlockInfo(block);
        });
    }

    _toggleBlockInterlink() {
        if (this._blockInterlinkCollapsed) {
            this._blockInterlinkCollapsed = false;
            this.$blockInterlink.parentNode.classList.remove('collapsed');
            this._updateUserRequestedBlock();
        } else {
            this._blockInterlinkCollapsed = true;
            this.$blockInterlink.parentNode.classList.add('collapsed');
        }
    }

    _toggleTransactions() {
        if (this._blockTransactionsCollapsed) {
            this._blockTransactionsCollapsed = false;
            this.$blockTransactions.parentNode.classList.remove('collapsed');
            this._updateUserRequestedBlock();
        } else {
            this._blockTransactionsCollapsed = true;
            this.$blockTransactions.parentNode.classList.add('collapsed');
        }
    }
}
