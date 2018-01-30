var CLIENT_NANO = 'nano';
var CLIENT_LIGHT = 'light';
var CLIENT_FULL = 'full';

class DevUI {
    constructor($) {
        $.blockchain.on('head-changed', this._headChanged.bind(this));

        $.network.on('peers-changed', this._networkChanged.bind(this));

        $.mempool.on('transaction-added', function (tx) {
            if ($.clientType !== CLIENT_NANO) {
                this._mempoolTransactionAdded(tx);
            } else {
                // on nano rerender complete mempool as it doesn't fire a separate transactions-ready
                this._rerenderMempool(true);
            }
        }.bind(this));
        if ($.clientType !== CLIENT_NANO) {
            $.mempool.on('transactions-ready', this._rerenderMempool.bind(this));
            $.miner.on('start', this._minerChanged.bind(this));
            $.miner.on('stop', this._minerChanged.bind(this));
            $.miner.on('hashrate-changed', this._minerChanged.bind(this));
            $.miner.on('block-mined', this._blockMined.bind(this));
        }

        var bcTitle = document.querySelector('#bcTitle');
        var txSubmitBtn = document.querySelector('#txSubmitBtn');
        $.consensus.on('syncing', function() {
            bcTitle.classList.add('syncing');
        }.bind(this));
        $.consensus.on('sync-chain-proof', function() {
            bcTitle.classList.add('sync-chain-proof');
        }.bind(this));
        $.consensus.on('verify-chain-proof', function() {
            bcTitle.classList.add('verify-chain-proof');
        }.bind(this));
        $.consensus.on('sync-accounts-tree', function() {
            bcTitle.classList.add('sync-accounts-tree');
        }.bind(this));
        $.consensus.on('verify-accounts-tree', function() {
            bcTitle.classList.add('verify-accounts-tree');
        }.bind(this));

        $.consensus.on('established', function() {
            bcTitle.classList.add('consensus-established');
            txSubmitBtn.removeAttribute('disabled');
            this._headChanged($.blockchain.head);
            //document.getElementById('mnrStartBtn').removeAttribute('disabled');
        }.bind(this));

        $.consensus.on('lost', function() {
            if ($.clientType !== CLIENT_NANO) {
                $.miner.stopWork();
            }
            bcTitle.classList.remove('initializing', 'connecting', 'syncing', 'sync-chain-proof', 'verify-chain-proof',
                'sync-accounts-tree', 'verify-accounts-tree', 'consensus-established');
            txSubmitBtn.setAttribute('disabled', '');
            //document.getElementById('mnrStartBtn').setAttribute('disabled', '');
        }.bind(this));

        // Blockchain
        /** @type {HTMLElement} */
        this._bcHeight = document.querySelector('#bcHeight');
        /** @type {HTMLElement} */
        this._bcTotalDifficulty = document.querySelector('#bcTotalDifficulty');
        /** @type {HTMLElement} */
        this._bcTotalWork = document.querySelector('#bcTotalWork');
        /** @type {HTMLElement} */
        this._bcAverageBlockTime = document.querySelector('#bcAverageBlockTime');
        /** @type {HTMLElement} */
        this._bcLastBlockTime = document.querySelector('#bcLastBlockTime');
        /** @type {HTMLElement} */
        this._bcAccountsHash = document.querySelector('#bcAccountsHash');

        // Head block
        /** @type {HTMLElement} */
        this._hdHash = document.querySelector('#hdHash');
        /** @type {HTMLElement} */
        this._hdPoW = document.querySelector('#hdPoW');
        /** @type {HTMLElement} */
        this._hdPrevHash = document.querySelector('#hdPrevHash');
        /** @type {HTMLElement} */
        this._hdAccountsHash = document.querySelector('#hdAccountsHash');
        /** @type {HTMLElement} */
        this._hdDifficulty = document.querySelector('#hdDifficulty');
        /** @type {HTMLElement} */
        this._hdTimestamp = document.querySelector('#hdTimestamp');
        /** @type {HTMLElement} */
        this._hdNonce = document.querySelector('#hdNonce');
        /** @type {HTMLElement} */
        this._hdInterlink = document.querySelector('#hdInterlink');

        // Network
        /** @type {HTMLElement} */
        this._netPeerAddress = document.querySelector('#netPeerAddress');
        /** @type {HTMLElement} */
        this._netPeerCount = document.querySelector('#netPeerCount');
        /** @type {HTMLElement} */
        this._netPeerCountWs = document.querySelector('#netPeerCountWs');
        /** @type {HTMLElement} */
        this._netPeerCountRtc = document.querySelector('#netPeerCountRtc');
        /** @type {HTMLElement} */
        this._netBytesReceived = document.querySelector('#netBytesReceived');
        /** @type {HTMLElement} */
        this._netBytesSent = document.querySelector('#netBytesSent');

        setInterval(this._networkChanged.bind(this), 2500);

        // Wallet
        /** @type {HTMLElement} */
        this._wltAddress = document.querySelector('#wltAddress');
        /** @type {HTMLElement} */
        this._wltBalance = document.querySelector('#wltBalance');

        this._wltAddress.innerText = $.wallet.address.toUserFriendlyAddress();

        txSubmitBtn.onclick = this._submitTransaction.bind(this);

        // Mempool
        /** @type {HTMLElement} */
        this._mplTransactionCount = document.querySelector('#mplTransactionCount');
        /** @type {HTMLElement} */
        this._mplTransactions = document.querySelector('#mplTransactions');

        // Miner
        /** @type {HTMLElement} */
        this._mnrWorking = document.querySelector('#mnrWorking');
        /** @type {HTMLElement} */
        this._mnrHashrate = document.querySelector('#mnrHashrate');
        /** @type {HTMLElement} */
        this._mnrLastBlockTs = document.querySelector('#mnrLastBlockTs');

        /** @type {HTMLElement} */
        this._mnrStartBtn = document.querySelector('#mnrStartBtn');

        if ($.clientType !== CLIENT_NANO) {
            this._mnrStartBtn.onclick = this._toggleMining.bind(this);
        }

        // Init values.
        this._headChanged($.blockchain.head, true);
        this._updateBalance();
        this._networkChanged();
        this._rerenderMempool($.clientType === CLIENT_NANO);

        if ($.clientType !== CLIENT_NANO) {
            this._minerChanged();
        }
    }

    _submitTransaction(e) {
        /** @var {HTMLInputElement} */
        var elRecipientAddr = document.querySelector('#txRecipientAddr');
        /** @var {HTMLInputElement} */
        var elValue = document.querySelector('#txValue');
        /** @var {HTMLInputElement} */
        var elFee = document.querySelector('#txFee');
        elRecipientAddr.className = null;
        elValue.className = null;
        elFee.className = null;

        var recipientAddr = elRecipientAddr.value;
        var value = parseFloat(elValue.value);
        var fee = parseFloat(elFee.value);

        if (!recipientAddr) {
            elRecipientAddr.className = 'error';
            return;
        }
        var address;
        try {
            address = Nimiq.Address.fromUserFriendlyAddress(recipientAddr);
        } catch (e) {
            elRecipientAddr.className = 'error';
            return;
        }

        if (isNaN(value) || value <= 0) {
            elValue.className = 'error';
            return;
        }

        if (isNaN(fee) || fee < 0) {
            elFee.className = 'error';
            return;
        }

        this._getAccount($.wallet.address).then(function(account) {
            value = Nimiq.Policy.coinsToSatoshis(value);
            fee = Nimiq.Policy.coinsToSatoshis(fee);

            var waitingTransactions = $.mempool.getWaitingTransactions($.wallet.publicKey.toAddressSync());

            if (!account || account.balance < value + fee + waitingTransactions.map(t => t.value + t.fee).reduce((a, b) => a + b, 0)) {
                elValue.className = 'error';
                return;
            }

            $.wallet.createTransaction(address, value, fee, $.blockchain.height + 1)
                .then(this._broadcastTransaction.bind(this));
        }.bind(this));

        e.preventDefault();
        return false;
    }

    _headChanged(head, rebranching) {
        this._bcHeight.innerText = $.blockchain.height;
        this._bcAccountsHash.innerText = $.blockchain.head.accountsHash.toBase64();
        this._showBlockTime();

        if ($.clientType !== CLIENT_NANO) {
            this._bcTotalDifficulty.innerText = $.blockchain.totalDifficulty;
            this._bcTotalWork.innerText = $.blockchain.totalWork;
        }


        this._hdHash.innerText = $.blockchain.headHash.toBase64();
        this._hdPrevHash.innerText = $.blockchain.head.prevHash.toBase64();
        this._hdAccountsHash.innerText = $.blockchain.head.accountsHash.toBase64();
        this._hdTimestamp.innerText = new Date($.blockchain.head.timestamp * 1000);
        this._hdNonce.innerText = $.blockchain.head.nonce;

        var interlink = `<hash>${head.interlink.hashes.map((it,i) => i + ':' + it.toBase64()).join('</hash><br><hash>')}</hash>`;
        this._hdInterlink.innerHTML = interlink;

        $.blockchain.head.pow().then(function(pow) {
            var realDifficulty = Nimiq.BlockUtils.realDifficulty(pow);
            this._hdPoW.innerText = pow.toBase64();
            this._hdDifficulty.innerText = `${$.blockchain.head.difficulty} (${realDifficulty})`;
        }.bind(this));

        /*
        var el = document.createElement('div');
        var date = new Date(head.timestamp * 1000);
        var html = `<div><b>${date}</b> hash=<hash>${$.blockchain.headHash.toBase64()}</hash>, `
            + `difficulty=${head.difficulty} (${realDifficulty}), interlink=[${interlink}]</div>`;

        var txPromises = [];
        head.transactions.forEach(function(tx) {
            var value = DevUI.toFixedPrecision(Nimiq.Policy.satoshisToCoins(tx.value));
            var fee = DevUI.toFixedPrecision(Nimiq.Policy.satoshisToCoins(tx.fee));
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

        if (!rebranching) {
            this._updateBalance();
        }
    }

    _toggleMining() {
        //if (!$.consensus.established) {
        //    console.warn('Not starting miner - consensus not established');
        //    return;
        //}

        if (!$.miner.working) {
            $.miner.startWork();
        } else {
            $.miner.stopWork();
        }
    }

    _networkChanged() {
        this._netPeerAddress.innerText = $.network._netconfig.peerAddress;
        this._netPeerCount.innerText = $.network.peerCount;
        this._netPeerCountWs.innerText = $.network.peerCountWebSocket;
        this._netPeerCountRtc.innerText = $.network.peerCountWebRtc;
        this._netBytesReceived.innerText = DevUI._humanBytes($.network.bytesReceived);
        this._netBytesSent.innerText = DevUI._humanBytes($.network.bytesSent);
    }

    _minerChanged() {
        this._mnrWorking.innerText = $.miner.working;
        this._mnrHashrate.innerText = $.miner.hashrate;
        this._mnrLastBlockTs.innerText = this._lastBlockMinedTs ?
            new Date(this._lastBlockMinedTs) : '-';
        if ($.miner.working) {
            this._mnrStartBtn.innerText = 'Stop Mining';
        } else {
            this._mnrStartBtn.innerText = 'Start Mining';
        }
    }

    _blockMined() {
        this._lastBlockMinedTs = Date.now();
        this._minerChanged();
    }

    _getAccount(address) {
        if ($.clientType !== CLIENT_NANO) {
            return $.accounts.get(address);
        } else {
            return $.consensus.getAccount(address); // TODO can fail
        }
    }

    _broadcastTransaction(tx) {
        if ($.clientType !== CLIENT_NANO) {
            $.mempool.pushTransaction(tx);
        } else {
            $.consensus.relayTransaction(tx); // TODO can fail
        }
    }

    _updateBalance() {
        if ($.clientType === CLIENT_NANO && !$.consensus.established) {
            return;
        }
        this._getAccount($.wallet.address).then(function(account) {
            account = account || Nimiq.BasicAccount.INITIAL;
            this._wltBalance.innerText = DevUI._toFixedPrecision(Nimiq.Policy.satoshisToCoins(account.balance));
        }.bind(this));
    }

    _mempoolTransactionAdded(tx) {
        // XXX inefficient
        var txs = $.mempool.getTransactions();
        this._mplTransactionCount.innerText = txs.length;

        this._renderMempoolTransaction(tx);
    }

    _rerenderMempool(filter) {
        // XXX inefficient
        var txs = $.mempool.getTransactions();
        this._mplTransactionCount.innerText = txs.length;

        this._mplTransactions.innerHTML = '';

        txs.forEach(function(tx) {
            if (filter && !$.wallet.address.equals(tx.sender) && !$.wallet.address.equals(tx.recipient)) {
                return;
            }
            this._renderMempoolTransaction(tx);
        }.bind(this));
    }

    _renderMempoolTransaction(tx) {
        var el = document.createElement('div');
        var value = Nimiq.Policy.satoshisToCoins(tx.value).toFixed(4);
        var fee = Nimiq.Policy.satoshisToCoins(tx.fee).toFixed(4);
        el.innerHTML = `from=<hash>${tx.sender.toUserFriendlyAddress(false)}</hash>, to=<hash>${tx.recipient.toUserFriendlyAddress(false)}</hash>, value=${value}, fee=${fee}, validityStartHeight=${tx.validityStartHeight}`;
        this._mplTransactions.appendChild(el);
    }

    _showBlockTime() {
        const headBlock = $.blockchain.head;
        const tailHeight = Math.max(headBlock.height - Nimiq.Policy.DIFFICULTY_BLOCK_WINDOW, 1);

        $.blockchain.getBlockAt(tailHeight).then(function(tailBlock) {
            let averageBlockTime;
            if (tailBlock) {
                averageBlockTime = (headBlock.timestamp - tailBlock.timestamp) / (Math.max(headBlock.height - tailBlock.height, 1));
            } else {
                averageBlockTime = 'unknown';
            }
            this._bcAverageBlockTime.innerText = averageBlockTime + 's';
        }.bind(this));

        $.blockchain.getBlock(headBlock.prevHash).then(function(prevBlock) {
            this._bcLastBlockTime.innerText = (prevBlock ? (headBlock.timestamp - prevBlock.timestamp) : 0) + 's';
        }.bind(this));
    }

    static _humanBytes(bytes) {
        var i = 0;
        var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        while (bytes > 1024) {
            bytes /= 1024;
            i++;
        }
        return (Number.isInteger(bytes) ? bytes : bytes.toFixed(2)) + ' ' + units[i];
    }

    static _toFixedPrecision(value, precision) {
        precision = precision === undefined? Math.log10(Nimiq.Policy.SATOSHIS_PER_COIN) : precision;
        return value.toFixed(precision);
    }
}

// Safari quirks: don't use the same var name in global scope as id of html element
var overlay_ = document.querySelector('#overlay');

function startNimiq() {
    var clientType = location.hash.substr(1);
    if (clientType!==CLIENT_NANO && clientType!==CLIENT_LIGHT && clientType!==CLIENT_FULL) {
        alert('Please navigate to /#nano, /#light or /#full to select a client type.');
        return;
    }
    document.body.setAttribute('client', clientType);

    const bcTitle = document.querySelector('#bcTitle');
    bcTitle.classList.add('initializing');
    document.querySelector('#wltAddress').innerHTML = '<i>loading...</i>';

    Nimiq.init(async function() { // TODO remove async await
        var $ = {};
        window.$ = $;
        $.clientType = clientType;
        $.consensus = await Nimiq.Consensus[clientType]();

        // XXX Legacy API
        $.blockchain = $.consensus.blockchain;
        $.mempool = $.consensus.mempool;
        $.network = $.consensus.network;

        // XXX Legacy components
        $.wallet = await Nimiq.Wallet.getPersistent();

        if (clientType !== CLIENT_NANO) {
            $.accounts = $.blockchain.accounts;
            $.miner = new Nimiq.Miner($.blockchain, $.mempool, $.network.time, $.wallet.address);
        }

        bcTitle.classList.add('connecting');
        $.network.connect();

        overlay_.style.display = 'none';
        window.ui = new DevUI($);
    }, function(code) {
        bcTitle.classList.remove('initializing');
        document.querySelector('#wltAddress').innerText = '';

        switch (code) {
            case Nimiq.ERR_WAIT:
                overlay_.style.display = 'block';
                break;
            case Nimiq.ERR_UNSUPPORTED:
                alert('Browser not supported');
                break;
            default:
                alert('Nimiq initialization error');
                break;
        }
    });
}

startNimiq();
