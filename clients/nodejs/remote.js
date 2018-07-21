const http = require('http');
const Nimiq = require('../../dist/node.js');
const chalk = require('chalk');
const btoa = require('btoa');
const readline = require('readline');
const argv = require('minimist')(process.argv.slice(2));

let host = '127.0.0.1';
let port = 8648;
let user = null;
let password = null;
if (argv.host) host = argv.host;
if (argv.port) port = parseInt(argv.port);
if (argv.user) {
    user = argv.user;
    const Writable = require('stream').Writable;
    // Hide password in command line.
    const mutableStdout = new Writable({
        write: function(chunk, encoding, callback) {
            if (!this.muted) {
                process.stdout.write(chunk, encoding);
            }
            callback();
        }
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: mutableStdout,
        terminal: true
    });

    mutableStdout.muted = false;
    // Request password.
    rl.question(`Password for ${user}: `, (pw) => {
        password = pw;
        console.log(""); // Add newline
        rl.close();
        main(argv._);
    });
    mutableStdout.muted = true;
} else {
    // Continue without authentication.
    main(argv._);
}

function jsonRpcFetch(method, ...params) {
    return new Promise((resolve, fail) => {
        while (params.length > 0 && typeof params[params.length - 1] === 'undefined') params.pop();
        const jsonrpc = JSON.stringify({
            jsonrpc: '2.0',
            id: 42,
            method: method,
            params: params
        });
        const headers = {'Content-Length': jsonrpc.length};
        if (user && password) {
            headers['Authorization'] = `Basic ${btoa(`${user}:${password}`)}`;
        }
        const req = http.request({
            hostname: host,
            port: port,
            method: 'POST',
            headers: headers
        }, (res) => {
            if (res.statusCode === 401) {
                fail(new Error(`Request Failed: Authentication Required. Status Code: ${res.statusCode}`));
                res.resume();
                return;
            }
            if (res.statusCode !== 200) {
                fail(new Error(`Request Failed. Status Code: ${res.statusCode}`));
                res.resume();
                return;
            }

            res.setEncoding('utf8');
            let rawData = '';
            res.on('error', fail);
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    const parse = JSON.parse(rawData);
                    if (parse.error) {
                        fail(parse.error.message);
                    } else {
                        resolve(parse.result);
                    }
                } catch (e) {
                    fail(e);
                }
            });
        });
        req.on('error', fail);
        req.write(jsonrpc);
        req.end();
    });
}

function isTrue(val) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
        val = val.toLowerCase();
        return val === 'true' || val === 'yes';
    }
    return false;
}

function genesisInfo(hash) {
    let chain = 'private';
    let color = 'tomato';
    for (const c in Nimiq.GenesisConfig.CONFIGS) {
        if (hash === Nimiq.GenesisConfig.CONFIGS[c].GENESIS_BLOCK.hash().toHex()) {
            chain = c;
            color = 'gold';
        }
    }
    if (chain === 'main') color = 'dodgerblue';
    return {color, chain};
}

function peerAddressStateName(peerState) {
    switch (peerState) {
        case Nimiq.PeerAddressState.NEW:
            return 'New';
        case Nimiq.PeerAddressState.ESTABLISHED:
            return chalk.green('Established');
        case Nimiq.PeerAddressState.TRIED:
            return chalk.yellow('Tried');
        case Nimiq.PeerAddressState.FAILED:
            return chalk.yellow('Failed');
        case Nimiq.PeerAddressState.BANNED:
            return chalk.red('Banned');
    }
    return 'Unknown';
}

function connectionStateName(connectionState) {
    switch (connectionState) {
        case Nimiq.PeerConnectionState.NEW:
            return chalk.yellow('New');
        case Nimiq.PeerConnectionState.ESTABLISHED:
            return chalk.green('Established');
        case Nimiq.PeerConnectionState.CONNECTING:
            return chalk.yellow('Connecting');
        case Nimiq.PeerConnectionState.CONNECTED:
            return chalk.yellow('Connected');
        case Nimiq.PeerConnectionState.NEGOTIATING:
            return chalk.yellow('Negotiating');
    }
    return 'Unknown';
}

function accountTypeName(type) {
    switch (type) {
        case Nimiq.Account.Type.BASIC:
            return 'Basic Account';
        case Nimiq.Account.Type.VESTING:
            return 'Vesting Contract';
        case Nimiq.Account.Type.HTLC:
            return 'Hashed Time-Locked Contract';
    }
    return 'Unknown';
}

function bytesFormat(bytes) {
    if (bytes < 2000) return `${bytes} B`;
    if (bytes < 2000000) return `${Math.round(bytes / 100) / 10} kB`;
    if (bytes < 2000000000) return `${Math.round(bytes / 100000) / 10} MB`;
    return `${Math.round(bytes / 1000000)} MB`;
}

function nimValueFormat(value, fixedLength = 0, withSign = false) {
    let valueFirst = (Math.round(value / 1000) / 100).toFixed(2);
    if (withSign && value > 0) valueFirst = `+${valueFirst}`;
    valueFirst = new Array(Math.max(0, fixedLength - valueFirst.length)).join(' ') + valueFirst;
    const valueSecond = ((value % 1000) / 1000).toFixed(3).substring(2);
    return chalk`{bold ${valueFirst}}${valueSecond} NIM`;
}

function approxTimeDifference(diff, withA) {
    diff = Math.abs(diff);
    if (diff < 600) return `${withA ? 'a ' : ''}few minutes`;
    if (diff < 3600) return `${Math.round(diff / 300) * 5} minutes`;
    if (diff < 60 * 60 * 48) return `${Math.round(diff / 3600)} hours`;
    if (diff < 60 * 60 * 24 * 90) return `${Math.round(diff / 86400)} days`;
    if (diff < 60 * 60 * 24 * 600) return `${Math.round(diff / 2592000)} months`;
    return `${Math.round(diff / 32536000)} years`;
}

/**
 * @param {number} blockNumber
 * @param {Block} [head]
 */
function blockNumberFormat(blockNumber, head) {
    if (!head) return blockNumber.toString();
    if (blockNumber === head.height) return `${blockNumber} (Now)`;
    const targetTimestamp = head.timestamp - (head.height - blockNumber) * Nimiq.Policy.BLOCK_TIME;
    const diff = targetTimestamp - Date.now() / 1000;
    return `${blockNumber} (${diff < 0 ? 'in ' : ''}${approxTimeDifference((head.height - blockNumber) * 60, true)}${diff > 0 ? ' ago' : ''})`;
}

function blockAmountFormat(blocks) {
    return `${blocks} (${approxTimeDifference(blocks * Nimiq.Policy.BLOCK_TIME)})`;
}

async function displayInfoHeader(width = 0) {
    const genesisBlock = await jsonRpcFetch('getBlockByNumber', 1);
    const blockNumber = await jsonRpcFetch('blockNumber');
    const peerCount = await jsonRpcFetch('peerCount');
    const consensus = await jsonRpcFetch('consensus');
    const {color, chain} = genesisInfo(genesisBlock.hash);
    //const state = syncing ? `Syncing. [${Math.round(100 * (syncing.currentBlock - syncing.startingBlock) / (syncing.highestBlock - syncing.startingBlock))}%]` : 'On sync.';
    const state = consensus === 'established' ? 'Consensus established.' : consensus === 'syncing' ? 'Syncing...' : consensus === 'lost' ? 'Consensus lost.' : 'Unknown state.';
    const descr = chalk`${peerCount} peers | ⛃ ${blockNumber} | ${state}`;
    if (chain !== 'main') {
        const chainPrefix = chalk.keyword('black').bgKeyword(color)(` ${chain}-net `) + ' ';
        const widthBefore = chain.length + 15 + descr.length;
        const placeHolder = Array(Math.max(0, Math.round((width - widthBefore) / 2))).join(' ');
        console.log(chalk`${placeHolder}${chainPrefix}{keyword("gold") Nimiq} | ${descr}${placeHolder}`);
        if (width <= widthBefore) width = widthBefore + 1;
    } else {
        const widthBefore = descr.length + 8;
        const placeHolder = Array(Math.max(0, Math.round((width - widthBefore) / 2))).join(' ');
        console.log(chalk`${placeHolder}{keyword("gold") Nimiq} | ${descr}${placeHolder}`);
        if (width <= widthBefore) width = widthBefore + 1;
    }
    console.log(Array(width).join('⎺'));
}

function displayBlock(block, hashOrNumber) {
    if (!block) {
        console.log(chalk`Block {bold ${hashOrNumber}} not found.`);
        return;
    }
    console.log(chalk`Block {bold ${block.hash}}:`);
    console.log(`Number      | ${block.number}`);
    console.log(`PoW-Hash    | ${block.pow}`);
    console.log(`Parent-Hash | ${block.parentHash}`);
    console.log(`Miner       | ${block.minerAddress}`);
    console.log(`Timestamp   | ${new Date(block.timestamp * 1000).toString()}`);
    console.log(`Size        | ${block.size} bytes (${block.transactions.length} transactions)`);
    console.log(`Difficulty  | ${block.difficulty}`);
    console.log(`Extra       | ${block.extraData || null}`);
}

async function displayAccount(account, name, head) {
    if (!account) {
        console.log(chalk`Account {bold ${name}} not found.`);
    }
    if (!head && account.type !== Nimiq.Account.Type.BASIC) {
        head = await jsonRpcFetch('getBlockByNumber', 'latest');
    }
    console.log(chalk`Account {bold ${account.address}}:`);
    console.log(`Type          | ${accountTypeName(account.type)}`);
    console.log(`Balance       | ${nimValueFormat(account.balance)}`);
    if (account.type === Nimiq.Account.Type.VESTING) {
        console.log(`Vested amount | ${account.vestingTotalAmount}`);
        console.log(`Vesting start | ${blockNumberFormat(account.vestingStart, head)}`);
        console.log(`Vesting step  | ${nimValueFormat(account.vestingStepAmount)} every ${blockAmountFormat(account.vestingStepBlocks)}`);
        if (account.vestingStart + Math.ceil(account.vestingTotalAmount / account.vestingStepAmount) * account.vestingStepBlocks > head.height) {
            let nextVestingBlockNumber = account.vestingStart + account.vestingStepBlocks;
            while (nextVestingBlockNumber < head.height) nextVestingBlockNumber += account.vestingStepBlocks;
            const nextVestingAmount = Math.min(account.vestingStepAmount, account.vestingTotalAmount - Math.floor((head.height - account.vestingStart) / account.vestingStepBlocks) * account.vestingStepAmount);
            console.log(`Next vesting  | ${nimValueFormat(nextVestingAmount)} at ${blockNumberFormat(nextVestingBlockNumber, head)}`);
        } else {
            console.log(chalk`Next vesting  | {italic Fully vested}`);
        }
    } else if (account.type === Nimiq.Account.Type.HTLC) {
        console.log(`Sender        | ${account.senderAddress}`);
        console.log(`Recipient     | ${account.recipientAddress}`);
        console.log(`Locked amount | ${account.totalAmount}`);
        console.log(`Timeout       | ${blockNumberFormat(account.timeout, head)}`);
        console.log(`Hash depth    | ${account.hashCount}`);
        console.log(`Hash root     | ${account.hashRoot}`);
    }

}

async function displayTransaction(transaction, hashOrNumber, index, beforeSend) {
    if (!transaction) {
        if (typeof index !== 'undefined') {
            console.log(chalk`Block {bold ${hashOrNumber}} not found or has less than {bold ${index - 1}} transactions.`);
        } else {
            console.log(chalk`Transaction {bold ${hashOrNumber}} not found.`);
        }
        return;
    }
    let block = null;
    if (transaction.blockHash) block = await jsonRpcFetch('getBlockByHash', transaction.blockHash);
    if (!beforeSend) {
        console.log(chalk`Transaction {bold ${transaction.hash}}:`);
    } else {
        console.log(chalk`Transaction to send:`);
    }
    console.log(`From          | ${transaction.fromAddress}`);
    console.log(`To            | ${transaction.toAddress}`);
    if (block) {
        console.log(`Timestamp     | ${new Date(block.timestamp * 1000).toString()}`);
    } else if (!beforeSend) {
        console.log(chalk`Timestamp     | {italic Pending...}`);
    }
    console.log(`Amount        | ${nimValueFormat(transaction.value)}`);
    console.log(`Fee           | ${nimValueFormat(transaction.fee)}`);
    console.log(`Data          | ${transaction.data}`);
    if (block) {
        console.log(`In block      | ${block.number} (index ${transaction.transactionIndex})`);
        console.log(`Confirmations | ${transaction.confirmations}`);
    } else if (!beforeSend) {
        console.log(chalk`In block      | {italic Pending...}`);
        console.log('Confirmations | 0');
    }
}

function displayPeerState(peerState, desc) {
    if (!peerState) {
        console.log(chalk`Peer {bold ${desc}} not found.`);
        return;
    }
    console.log(chalk`Peer {bold ${peerState.id}}:`);
    console.log(`Address         | ${peerState.address}`);
    console.log(`Failed attempts | ${peerState.failedAttempts}`);
    console.log(`A-State         | ${peerAddressStateName(peerState.addressState)}`);
    if (peerState.connectionState) {
        console.log(`C-State         | ${connectionStateName(peerState.connectionState)}`);
        console.log(`Head hash       | ${peerState.headHash}`);
        console.log(`Time offset     | ${peerState.timeOffset}`);
        console.log(`Latency         | ${peerState.latency}`);
        console.log(`Traffic         | ${bytesFormat(peerState.rx)} RX / ${bytesFormat(peerState.tx)} TX`);
    } else {
        console.log('C-State         | Disconnected');
    }
}

function formatMonth(month) {
    switch (month) {
        case 0:
            return 'JAN';
        case 1:
            return 'FEB';
        case 2:
            return 'MAR';
        case 3:
            return 'APR';
        case 4:
            return 'MAY';
        case 5:
            return 'JUN';
        case 6:
            return 'JUL';
        case 7:
            return 'AUG';
        case 8:
            return 'SEP';
        case 9:
            return 'OCT';
        case 10:
            return 'NOV';
        case 11:
            return 'DEC';
    }
    return '???';
}

async function action(args, rl) {
    switch (args[0]) {
        // Miner
        case 'mining': {
            if (!rl && !argv.silent) {
                await displayInfoHeader();
            }
            const enabled = await jsonRpcFetch('mining');
            if (!enabled) {
                console.log('Mining is disabled.');
            } else {
                const hashrate = await jsonRpcFetch('hashrate');
                const threads = await jsonRpcFetch('minerThreads');
                console.log(chalk`Mining with {bold ${hashrate} H/s} on {bold ${threads}} threads.`);
            }
            return;
        }
        case 'mining.json': {
            console.log(JSON.stringify({
                enabled: await jsonRpcFetch('mining'),
                hashrate: await jsonRpcFetch('hashrate'),
                threads: await jsonRpcFetch('minerThreads')
            }));
            return;
        }
        case 'mining.enabled': {
            console.log(await jsonRpcFetch('mining', args.length > 1 ? isTrue(args[1]) : undefined));
            return;
        }
        case 'mining.hashrate': {
            console.log(await jsonRpcFetch('hashrate'));
            return;
        }
        case 'mining.threads': {
            console.log(await jsonRpcFetch('minerThreads', args.length > 1 ? parseInt(args[1]) : undefined));
            return;
        }
        // Accounts
        case 'accounts': {
            if (!rl && !argv.silent) {
                await displayInfoHeader(68);
            }
            const accounts = await jsonRpcFetch('accounts');
            accounts.sort((a, b) => a.address > b.address);
            for (const account of accounts) {
                const balance = await jsonRpcFetch('getBalance', account.id);
                console.log(`${account.address} | ${nimValueFormat(balance, 14)}`);
            }
            return;
        }
        case 'accounts.json': {
            const accounts = await jsonRpcFetch('accounts');
            for (const account of accounts) {
                account.balance = await jsonRpcFetch('getBalance', account.id);
            }
            console.log(JSON.stringify(accounts));
            return;
        }
        case 'accounts.create': {
            const account = await jsonRpcFetch('createAccount');
            console.log(account.address);
            return;
        }
        case 'account': {
            if (!rl && !argv.silent) {
                await displayInfoHeader(81);
            }
            if (args.length === 2) {
                await displayAccount(await jsonRpcFetch('getAccount', args[1]), args[1]);
                return;
            }
            console.error('Specify account address');
            return;
        }
        case 'account.json': {
            if (args.length === 2) {
                console.log(JSON.stringify(await jsonRpcFetch('getAccount', args[1])));
                return;
            }
            console.error('Specify account address');
            return;
        }
        // Blocks
        case 'block': {
            if (!rl && !argv.silent) {
                await displayInfoHeader(79);
            }
            if (args.length === 2) {
                if (args[1].length === 64 || args[1].length === 44) {
                    displayBlock(await jsonRpcFetch('getBlockByHash', args[1]), args[1]);
                    return;
                } else if (args[1] === 'latest' || /^(latest-)?[0-9]*$/.test(args[1])) {
                    displayBlock(await jsonRpcFetch('getBlockByNumber', args[1]), args[1]);
                    return;
                }
            }
            console.error('Specify block number, block hash or \'latest\'');
            return;
        }
        case 'block.json': {
            if (args.length === 2) {
                if (args[1].length === 64 || args[1].length === 44) {
                    console.log(JSON.stringify(await jsonRpcFetch('getBlockByHash', args[1])));
                    return;
                } else if (args[1] === 'latest' || /^(latest-)?[0-9]*$/.test(args[1])) {
                    console.log(JSON.stringify(await jsonRpcFetch('getBlockByNumber', args[1])));
                    return;
                }
            }
            console.log(JSON.stringify(null));
            return;
        }
        // Transactions
        case 'transaction': {
            if (!rl && !argv.silent) {
                await displayInfoHeader(79);
            }
            if (args.length === 2) {
                await displayTransaction(await jsonRpcFetch('getTransactionByHash', args[1]), args[1]);
                return;
            } else if (args.length === 3) {
                if (args[1].length === 64 || args[1].length === 44) {
                    await displayTransaction(await jsonRpcFetch('getTransactionByBlockHashAndIndex', args[1], args[2]), args[1], args[2]);
                    return;
                } else if (args[1] === 'latest' || /^(latest-)?[0-9]*$/.test(args[1])) {
                    await displayTransaction(await jsonRpcFetch('getTransactionByBlockNumberAndIndex', args[1], args[2]), args[1], args[2]);
                    return;
                }
            }
            console.error('Specify transaction hash or block identifier (block number, block hash or \'latest\') and transaction index');
            return;
        }
        case 'transaction.json': {
            if (args.length === 2) {
                console.log(JSON.stringify(await jsonRpcFetch('getTransactionByHash', args[1])));
                return;
            } else if (args.length === 3) {
                if (args[1].length === 64 || args[1].length === 44) {
                    console.log(JSON.stringify(await jsonRpcFetch('getTransactionByBlockHashAndIndex', args[1], args[2])));
                    return;
                } else if (args[1] === 'latest' || /^(latest-)?[0-9]*$/.test(args[1])) {
                    console.log(JSON.stringify(await jsonRpcFetch('getTransactionByBlockNumberAndIndex', args[1], args[2])));
                    return;
                }
            }
            console.log(JSON.stringify(null));
            return;
        }
        case 'transaction.send': {
            if (!rl && !argv.silent) {
                await displayInfoHeader(74);
            }
            if (args.length < 5 || args.length > 6) {
                console.error('Arguments for \'transaction.send\': from, to, value, fee, [data]');
                return;
            }
            const from = Nimiq.Address.fromString(args[1]).toUserFriendlyAddress();
            const to = Nimiq.Address.fromString(args[2]).toUserFriendlyAddress();
            const value = Math.floor(parseFloat(args[3]) * 100000);
            const fee = Math.floor(parseFloat(args[4]) * 100000);
            const data = args.length === 6 ? args[5] : undefined;
            displayTransaction({fromAddress: from, toAddress: to, value: value, fee: fee, data: data || null}, undefined, undefined, true);
            let answer;
            if (rl) {
                answer = await new Promise((resolve) => {
                    rl.question('Are you sure you want to send this transaction? (y/N) ', resolve);
                });
            } else {
                // For backwards compatible use in scripts, assume yes here.
                answer = 'y';
            }
            if (answer.toLowerCase() === 'y') {
                const hash = await jsonRpcFetch('sendTransaction', {from, to, value, fee, data});
                console.log(chalk`Sent as {bold ${hash}}.`);
            } else {
                console.log(chalk`Transaction was {bold not} send.`);
            }
            return;
        }
        case 'transaction.receipt': {
            if (!rl && !argv.silent) {
                await displayInfoHeader(74);
            }
            if (args.length !== 2) {
                console.error('Specify transaction hash');
                return;
            }
            const receipt = await jsonRpcFetch('getTransactionReceipt', args[1]);
            if (!receipt) {
                console.log('Transaction not yet confirmed');
            } else {
                console.log(chalk`Receipt {bold ${receipt.transactionHash}}:`);
                console.log(`In block      | ${receipt.blockNumber} (at index ${receipt.transactionIndex})`);
                if (receipt.timestamp) console.log(`Timestamp     | ${new Date(receipt.timestamp * 1000).toString()}`);
                console.log(`Confirmations | ${receipt.confirmations}`);
            }
            return;
        }
        case 'transaction.receipt.json': {
            if (args.length !== 2) {
                console.error('Specify transaction hash');
                return;
            }
            console.log(JSON.stringify(await jsonRpcFetch('getTransactionReceipt', args[1])));
            return;
        }
        case 'transactions': {
            if (args.length < 2) {
                console.error('Specify account address');
                return;
            }
            if (!rl && !argv.silent) {
                await displayInfoHeader(75);
            }
            const transactions = (await jsonRpcFetch('getTransactionsByAddress', args[1], args[2])).sort((a, b) => a.timestamp > b.timestamp);
            const self = Nimiq.Address.fromString(args[1]);
            console.log(chalk`Transaction log for {bold ${self.toUserFriendlyAddress()}}:`);
            for (const tx of transactions) {
                const sent = self.toHex() === tx.from;
                const dir = sent ? '  to' : 'from';
                const other = sent ? tx.toAddress : tx.fromAddress;
                const date = new Date(tx.timestamp * 1000);
                const value = sent ? -(tx.value + tx.fee) : tx.value;
                let dateStr = date.getDate().toString();
                if (dateStr.length === 1) {
                    dateStr = ` ${dateStr} `;
                } else {
                    dateStr = `${dateStr[0]}${dateStr[1]} `;
                }
                console.log(chalk`${dateStr} | ${dir} ${other} | {${sent ? 'red' : 'green'} ${nimValueFormat(value, 10, true)}}`);
                console.log(`${formatMonth(date.getMonth())} | ID: ${tx.hash}`);
            }
            return;
        }
        case 'transactions.json': {
            if (args.length < 2) {
                console.error('Specify account address');
                return;
            }
            console.log(JSON.stringify(await jsonRpcFetch('getTransactionsByAddress', args[1], args[2])));
            return;
        }
        case 'mempool': {
            const mempoolStats = await jsonRpcFetch('mempool');
            console.log(chalk`Mempool stats ({bold ${mempoolStats.total}} transactions in total).`);
            console.log('By fee per byte:');
            for (let i = 0; i < mempoolStats.buckets.length; i++) {
                const bucket = mempoolStats.buckets[i];
                const count = mempoolStats[bucket];
                if (i === 0) {
                    console.log(`> ${bucket}:\t${count} transactions`);
                } else {
                    console.log(`${bucket}-${mempoolStats.buckets[i-1]}:\t${count} transactions`);
                }
            }
            return;
        }
        case 'mempool.content': {
            let includeTransactions = args.length === 2 && isTrue(args[1]);
            const transactions = await jsonRpcFetch('mempoolContent', includeTransactions);
            console.log(chalk`Mempool content ({bold ${transactions.length}} transactions):`);
            for (const tx of transactions) {
                if (includeTransactions) {
                    const date = new Date(tx.timestamp * 1000);
                    let dateStr = date.getDate().toString();
                    if (dateStr.length === 1) {
                        dateStr = ` ${dateStr} `;
                    } else {
                        dateStr = `${dateStr[0]}${dateStr[1]} `;
                    }
                    console.log(chalk`${dateStr} | ${tx.fromString} -> ${tx.toString} | ${nimValueFormat(tx.value, 10)} | ${nimValueFormat(tx.fee, 10)}`);
                    console.log(`ID: ${tx.hash}`);
                } else {
                    console.log(tx);
                }
            }
            return;
        }
        case 'mempool.content.json': {
            let includeTransactions = args.length === 2 && isTrue(args[1]);
            console.log(JSON.stringify(await jsonRpcFetch('mempoolContent', includeTransactions)));
            return;
        }
        case 'consensus.min_fee_per_byte': {
            console.log(await jsonRpcFetch('minFeePerByte', args[1]));
            return;
        }
        case 'constant': {
            if (args.length < 2) {
                console.error('Specify constant name');
                return;
            }
            console.log(await jsonRpcFetch('constant', args[1], args.length === 3 ? args[2] : undefined));
            return;
        }
        case 'peers': {
            const peerList = (await jsonRpcFetch('peerList')).sort((a, b) => a.addressState === 2 ? -1 : b.addressState === 2 ? 1 : a.addressState < b.addressState ? 1 : a.addressState > b.addressState ? -1 : a.address > b.address);
            const maxAddrLength = peerList.map(p => p.address.length).reduce((a, b) => Math.max(a, b), 0);
            if (!rl) {
                await displayInfoHeader(maxAddrLength + 15);
            }
            for (const peer of peerList) {
                const space = Array(maxAddrLength - peer.address.length + 1).join(' ');
                console.log(chalk`${peer.address}${space} | ${peer.connectionState ? connectionStateName(peer.connectionState) : peerAddressStateName(peer.addressState)}`);
            }
            return;
        }
        case 'peers.json': {
            console.log(JSON.stringify(await jsonRpcFetch('peerList')));
            return;
        }
        case 'peer': {
            if (args.length < 2) {
                console.error('Specify peer id');
                return;
            }
            const peerState = await jsonRpcFetch('peerState', args[1], args.length > 2 ? args[2] : undefined);
            if (!rl) {
                await displayInfoHeader((peerState ? peerState.address.length : 0) + 20);
            }
            displayPeerState(peerState, args[1]);
            return;
        }
        case 'peer.json': {
            if (args.length < 2) {
                console.error('Specify peer id');
                return;
            }
            console.log(JSON.stringify(await jsonRpcFetch('peerState', args[1], args.length > 2 ? args[2] : undefined)));
            return;
        }
        case 'default': {
            try {
                await displayInfoHeader(43);
            } catch (e) {
                console.log('Client not running.');
            }
            console.log('Use `help` command for usage instructions.');
            return;
        }
        case 'status': {
            try {
                await displayInfoHeader(79);
            } catch (e) {
                console.log('Client not running.');
            }
            return;
        }
        case 'log': {
            if (args.length < 2) {
                args.push('verbose');
            }
            if (args.length < 3) {
                args.splice(1, 0, '*');
            }
            if (args.length > 3) {
                console.error('Too many args');
                return;
            }
            args[2] = Nimiq.Log.Level.toString(Nimiq.Log.Level.get(args[2]));
            JSON.stringify(await jsonRpcFetch('log', args[1], args[2]));
            if (args[1] === '*') {
                console.log(`Global log level set to ${args[2]}`);
            } else {
                console.log(`Log level for tag ${args[1]} set to ${args[2]}`);
            }
            return;
        }
        case 'help':
        default:
            if (rl && args[0] !== 'help') {
                console.log('Unknown command. Use `help` command for usage instructions.');
                return;
            }

            if (!rl) {
                console.log(`Nimiq NodeJS JSON-RPC-Client

Usage:
    node remote.js [options] action [args]

Options:
    --host HOST             Define hostname or IP address of Nimiq JSON-RPC
                            server to connect to. Defaults to local host.
    --port PORT             Define port corresponding to HOST.
                            Defaults to 8648.
    --user USER             Use basic authentication with username USER.
                            The password will be prompted for.

`);
            }
            console.log(`Actions:
    account ADDR            Display details for account with address ADDR.
    accounts                List local accounts.
    block BLOCK             Display details of block BLOCK.
    constant CONST [VAL]    Display value of constant CONST. If VAL is given,
                            overrides constant const with value VAL.
    mining                  Display information on current mining settings.
    mining.enabled [VAL]    Read or change enabled state of miner.
    mining.threads [VAL]    Read or change number of threads of miner.
    peer PEER [ACTION]      Display details about peer PEER. If ACTION is
                            specified, invokes the named action on the peer.
                            Currently supported actions include:
                            connect, disconnect, ban, unban, fail
    peers                   List all known peer addresses and their current
                            connection state.
    transaction TX          Display details about transaction TX.
    transaction BLOCK IDX   Display details about transaction at index IDX in
                            block BLOCK.
    transaction.receipt TX  Display the transaction receipt for transaction TX.
    transaction.send SENDER RECIPIENT VALUE FEE [DATA]
                            Create, sign and send a transaction with the given
                            properties. The sending account must be a local
                            account.
    transactions ADDR [LIMIT]
                            Display at most LIMIT transactions involving address ADDR.
    mempool                 Display mempool stats.
    mempool.content [INCLUDE_TX]
                            Display mempool content. If INCLUDE_TX is given,
                            full transactions instead of transaction hashes
                            are requested.
    consensus.min_fee_per_byte [FEE]
                            Read or change the current min fee per byte setting.

Most actions support output either in human-readable text form (default) or as
JSON by appending '.json' to the action name. Addresses may be given in user-
friendly address format, hex or base64 encoded. Blocks can be specified by hash
in hex or base64 format or by the height on the main chain. Transactions are
understood in hex or base64 format of their hash. Peers may be given as their
peer id in hex or peer address.`);
    }
}

function main(args) {
    if (!args || args.length === 0) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            removeHistoryDuplicates: true,
            completer: function (line, callback) {
                if (line.indexOf(' ') < 0) {
                    const completions = ['account', 'accounts', 'accounts.create', 'block', 'constant',
                        'mining', 'mining.enabled', 'mining.threads', 'peer', 'peers',
                        'transaction', 'transaction.receipt', 'transaction.send', 'transactions',
                        'mempool', 'consensus.min_fee_per_byte'];
                    const hits = completions.filter((c) => c.startsWith(line));
                    callback(null, [hits.length ? hits : completions, line]);
                } else {
                    callback(null, []);
                }
            }
        });
        rl.on('line', async (line) => {
            line = line.trim();
            if (line === 'exit') {
                rl.close();
                return;
            }
            let args = [];
            while (line) {
                if (line[0] === '\'' || line[0] === '"') {
                    const close = line.indexOf(line[0], 1);
                    if (close < 0 || (line.length !== close + 1 && line[close + 1] !== ' ')) {
                        console.log('Invalid quoting');
                        line = null;
                        args = null;
                        break;
                    }
                    args.push(line.substring(1, close));
                    line = line.substring(close + 1).trim();
                } else {
                    let close = line.indexOf(' ');
                    if (close < 0) close = line.length;
                    args.push(line.substring(0, close));
                    line = line.substring(close + 1).trim();
                }
            }
            if (args !== null && args.length > 0) {
                try {
                    await action(args, rl);
                } catch (e) {
                    console.error(e);
                }
            }
            rl.prompt();
        });
        rl.on('close', () => {
            process.exit(0);
        });
        displayInfoHeader(79).then(() => rl.prompt()).catch((error) => {
            console.log(`Could not connect to Nimiq NodeJS client via RPC on ${host}:${port}.`);
            if (error.message) {
                console.log(error.message);
            }
            console.log('Use `help` command for usage instructions.');
            rl.close();
        });
    } else {
        action(args, false).catch(console.error);
    }
}
