const http = require('http');
const Nimiq = require('../../dist/node.js');
const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2));

let host = '127.0.0.1';
let port = 8648;
if (argv.host) host = argv.host;
if (argv.port) port = parseInt(argv.port);

function jsonRpcFetch(method, ...params) {
    return new Promise((resolve, fail) => {
        while (params.length > 0 && typeof params[params.length - 1] === 'undefined') params.pop();
        const jsonrpc = JSON.stringify({
            jsonrpc: '2.0',
            id: 42,
            method: method,
            params: params
        });
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            method: 'POST',
            headers: {'Content-Length': jsonrpc.length}
        }, (res) => {
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

// function printableHash(hash) {
//     return hash.replace(/../g, '$& ').trim().split(' ').map(c => chalk.keyword('black').bgHsv(parseInt(c, 16), 70, 100)(c)).join('');
// }

// function printableHash(hash) {
//     let str = hash.substring(0, 2);
//     for(let i = 2; i < hash.length - 2; i += 6) {
//         const h = hash.substring(i, i+6);
//         str += chalk.bgHex(h).hex(h)(h);
//     }
//     return str + hash.substring(hash.length - 2);
// }

function printableHash(hash) { return hash; }

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

async function displayTransaction(transaction, hashOrNumber, index) {
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
    console.log(chalk`Transaction {bold ${transaction.hash}}:`);
    console.log(`From      | ${transaction.fromAddress}`);
    console.log(`To        | ${transaction.toAddress}`);
    if (block) {
        console.log(`Timestamp | ${new Date(block.timestamp * 1000).toString()}`);
    } else {
        console.log(chalk`Timestamp | {italic Pending...}`);
    }
    const amountFirst = (Math.round(transaction.value / 1000) / 100).toFixed(2);
    const amountSecond = ((transaction.value % 1000) / 1000).toFixed(3).substring(2);
    console.log(chalk`Amount    | {bold ${amountFirst}}${amountSecond} NIM`);
    const feeFirst = (Math.round(transaction.fee / 1000) / 100).toFixed(2);
    const feeSecond = ((transaction.fee % 1000) / 1000).toFixed(3).substring(2);
    console.log(chalk`Fee       | {bold ${feeFirst}}${feeSecond} NIM`);
    console.log(`Data      | ${transaction.data}`);
    if (block) {
        console.log(`In block  | ${block.number} (index ${transaction.transactionIndex})`);
    } else {
        console.log(chalk`In block  | {italic Pending...}`);
    }
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

let args = argv._;
if (!args || args.length === 0) args = ['default'];

(async () => {
    switch (args[0]) {
        // Miner
        case 'mining': {
            await displayInfoHeader();
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
            console.log(await jsonRpcFetch('minerThreads', args[1]));
            return;
        }
        // Accounts
        case 'accounts': {
            await displayInfoHeader(68);
            const accounts = await jsonRpcFetch('accounts');
            accounts.sort((a, b) => a.address > b.address);
            for (const account of accounts) {
                const balance = await jsonRpcFetch('getBalance', account.id);
                let balanceFirst = (Math.round(balance / 1000) / 100).toFixed(2);
                balanceFirst = new Array(14 - balanceFirst.length).join(' ') + balanceFirst;
                const balanceSecond = ((balance % 1000) / 1000).toFixed(3).substring(2);
                console.log(`${account.address} | ${chalk.bold(balanceFirst)}${balanceSecond} NIM`);
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
        // Blocks
        case 'block': {
            await displayInfoHeader(79);
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
            await displayInfoHeader(79);
            if (args.length === 2) {
                await displayTransaction(await jsonRpcFetch('getTransactionByHash', args[1]));
                return;
            } else if (args.length === 3) {
                if (args[1].length === 64 || args[1].length === 44) {
                    await displayTransaction(await jsonRpcFetch('getTransactionByBlockHashAndIndex', args[1], args[2]));
                    return;
                } else if (args[1] === 'latest' || /^(latest-)?[0-9]*$/.test(args[1])) {
                    await displayTransaction(await jsonRpcFetch('getTransactionByBlockNumberAndIndex', args[1], args[2]));
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
            await displayInfoHeader(74);
            if (args.length < 5 || args.length > 6) {
                console.error('Arguments for \'transaction.send\': from, to, value, fee, [data]');
                return;
            }
            const from = args[1];
            const to = args[2];
            const value = Math.floor(parseFloat(args[3]) * 100000);
            const fee = Math.floor(parseFloat(args[4]) * 100000);
            const data = args.length === 6 ? args[5] : undefined;
            const hash = await jsonRpcFetch('sendTransaction', {from, to, value, fee, data});
            console.log(chalk`Sent as {bold ${hash}}.`);
            return;
        }
        case 'transaction.receipt': {
            await displayInfoHeader(74);
            if (args.length !== 2) {
                console.error('Specify transaction hash');
                return;
            }
            const receipt = await jsonRpcFetch('getTransactionReceipt', args[1]);
            if (!receipt) {
                console.log('Transaction not yet confirmed');
            }
            console.log(chalk`Receipt {bold ${receipt.transactionHash}}:`);
            console.log(`In block      | ${receipt.blockNumber} (at index ${receipt.transactionIndex})`);
            if (receipt.timestamp) console.log(`Timestamp     | ${new Date(receipt.timestamp*1000).toString()}`);
            console.log(`Confirmations | ${receipt.confirmations}`);
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
            const maxAddrLength = peerList.map(p => p.address.length).reduce((a,b) => Math.max(a,b), 0);
            await displayInfoHeader(maxAddrLength + 15);
            for(const peer of peerList) {
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
            if (!peerState) console.log('');
            await displayInfoHeader(peerState.address.length + 20);
            console.log(chalk`Peer {bold ${peerState.id}}:`);
            console.log(`Address          | ${peerState.address}`);
            console.log(`State            | ${peerAddressStateName(peerState.addressState)}`);
            console.log(`Failed attempts  | ${peerState.failedAttempts}`);
            if (peerState.connectionState) {
                console.log(`Connection state | ${connectionStateName(peerState.connectionState)}`);
                console.log(`Head hash        | ${peerState.headHash}`);
                console.log(`Time offset      | ${peerState.timeOffset}`);
            }
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
        case 'help':
        default:
    }
})().catch(console.error);
