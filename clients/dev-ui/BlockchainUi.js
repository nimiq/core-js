class BlockchainUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;

        this.$title = this.$el.querySelector('[title]');
        this.$chainHeight = this.$el.querySelector('[chain-height]');
        this.$totalDifficulty = this.$el.querySelector('[total-difficulty]');
        this.$totalWork = this.$el.querySelector('[total-work]');
        this.$averageBlockTime = this.$el.querySelector('[average-block-time]');
        this.$lastBlockTime = this.$el.querySelector('[last-block-time]');
        this.$chainAccountsHash = this.$el.querySelector('[chain-accounts-hash]');

        this.$headHash = this.$el.querySelector('[head-hash]');
        this.$headPowHash = this.$el.querySelector('[head-pow-hash]');
        this.$headPrevHash = this.$el.querySelector('[head-prev-hash]');
        this.$headAccountsHash = this.$el.querySelector('[head-accounts-hash]');
        this.$headDifficulty = this.$el.querySelector('[head-difficulty]');
        this.$headTimestamp = this.$el.querySelector('[head-timestamp]');
        this.$headNonce = this.$el.querySelector('[head-nonce]');
        this.$headInterlink = this.$el.querySelector('[head-interlink]');

        $.blockchain.on('head-changed', head => this._headChanged(head));
        $.consensus.on('syncing', () => this.$title.classList.add('syncing'));
        $.consensus.on('sync-chain-proof', () => this.$title.classList.add('sync-chain-proof'));
        $.consensus.on('verify-chain-proof', () => this.$title.classList.add('verify-chain-proof'));
        $.consensus.on('sync-accounts-tree', () => this.$title.classList.add('sync-accounts-tree'));
        $.consensus.on('verify-accounts-tree', () => this.$title.classList.add('verify-accounts-tree'));
        $.consensus.on('established', () => {
            this.$title.classList.add('consensus-established');
            this._headChanged($.blockchain.head);
        });
        $.consensus.on('lost', () => this.$title.classList.remove('initializing', 'connecting', 'syncing',
            'sync-chain-proof', 'verify-chain-proof', 'sync-accounts-tree', 'verify-accounts-tree',
            'consensus-established'));

        this.$title.classList.add('connecting');
        this._headChanged($.blockchain.head);
    }

    _headChanged(head) {
        this.$chainHeight.textContent = this.$.blockchain.height;
        this.$chainAccountsHash.textContent = this.$.blockchain.head.accountsHash.toBase64();
        this._showBlockTime();

        if ($.clientType !== DevUI.CLIENT_NANO) {
            this.$totalDifficulty.textContent = this.$.blockchain.totalDifficulty;
            this.$totalWork.textContent = this.$.blockchain.totalWork;
        }

        this.$headHash.textContent = this.$.blockchain.headHash.toBase64();
        this.$headPrevHash.textContent = this.$.blockchain.head.prevHash.toBase64();
        this.$headAccountsHash.textContent = this.$.blockchain.head.accountsHash.toBase64();
        this.$headTimestamp.textContent = new Date(this.$.blockchain.head.timestamp * 1000);
        this.$headNonce.textContent = this.$.blockchain.head.nonce;

        const interlink = `<hash>${head.interlink.hashes.map((it,i) => i + ':' + it.toBase64()).join('</hash><br><hash>')}</hash>`;
        this.$headInterlink.innerHTML = interlink;

        this.$.blockchain.head.pow().then(pow => {
            const realDifficulty = Nimiq.BlockUtils.realDifficulty(pow);
            this.$headPowHash.textContent = pow.toBase64();
            this.$headDifficulty.textContent = `${this.$.blockchain.head.difficulty} (${realDifficulty})`;
        });

        /*
        var el = document.createElement('div');
        var date = new Date(head.timestamp * 1000);
        var html = `<div><b>${date}</b> hash=<hash>${this.$.blockchain.headHash.toBase64()}</hash>, `
            + `difficulty=${head.difficulty} (${realDifficulty}), interlink=[${interlink}]</div>`;

        var txPromises = [];
        head.transactions.forEach(function(tx) {
            var value = Utils.satoshisToCoins(tx.value);
            var fee = Utils.satoshisToCoins(tx.fee);
            return `<div>&nbsp;-&gt; from=<hash>${tx.sender.toBase64()}</hash>, to=<hash>${tx.recipient.toBase64()}</hash>, value=${value}, fee=${fee}, nonce=${tx.nonce}</div>`;
        });

        Promise.all(txPromises).then(function(results) {
            el.innerHTML = html + results.join('');

            if (this._blockHistory.childNodes.length > 24) {
                this._blockHistory.removeChild(this._blockHistory.firstChild);
            }
            this._blockHistory.appendChild(el);
        }.bind(this));
        */
    }

    _showBlockTime() {
        const headBlock = this.$.blockchain.head;
        const tailHeight = Math.max(headBlock.height - Nimiq.Policy.DIFFICULTY_BLOCK_WINDOW, 1);

        this.$.blockchain.getBlockAt(tailHeight).then(tailBlock => {
            let averageBlockTime;
            if (tailBlock) {
                averageBlockTime = (headBlock.timestamp - tailBlock.timestamp) / (Math.max(headBlock.height - tailBlock.height, 1));
            } else {
                averageBlockTime = 'unknown';
            }
            this.$averageBlockTime.textContent = averageBlockTime + 's';
        });

        this.$.blockchain.getBlock(headBlock.prevHash).then(prevBlock => {
            this.$lastBlockTime.textContent = (prevBlock ? (headBlock.timestamp - prevBlock.timestamp) : 0) + 's';
        });
    }

}
