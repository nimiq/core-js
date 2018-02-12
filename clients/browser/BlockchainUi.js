class BlockchainUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;

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

        $.blockchain.on('head-changed', head => this._headChanged(head));
        $.consensus.on('established', () => this._headChanged($.blockchain.head));

        this._headChanged($.blockchain.head);
        const inputEventName = $.clientType === DevUi.ClientType.NANO? 'change' : 'input';
        this.$blockHeightInput.addEventListener(inputEventName, () => this._onUserRequestedBlockChanged());
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

        const interlink = `<hash>${block.interlink.hashes.map((it,i) => i + ':' + it.toBase64()).join('</hash><br><hash>')}</hash>`;
        this.$blockInterlink.innerHTML = interlink;

        block.pow().then(pow => {
            const realDifficulty = Nimiq.BlockUtils.realDifficulty(pow);
            this.$blockPowHash.textContent = pow.toBase64();
            this.$blockDifficulty.textContent = `${block.difficulty} (${realDifficulty})`;
        });

        /*
        var el = document.createElement('div');
        var date = new Date(block.timestamp * 1000);
        var html = `<div><b>${date}</b> hash=<hash>${block.hash().toBase64()}</hash>, `
            + `difficulty=${block.difficulty} (${realDifficulty}), interlink=[${interlink}]</div>`;

        var txPromises = [];
        block.transactions.forEach(function(tx) {
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

    _onUserRequestedBlockChanged() {
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
}
