# JSON-RPC Client

## Usage

`node remote.js [options] action [args]`

### Options

| Option | Description |
| --- | --- |
| `--host=HOST` | Define hostname or IP address of Nimiq JSON-RPC server to connect to. Defaults to local host.  |
| `--port=PORT` | Define port corresponding to HOST. Defaults to 8648. |
| `--user=USER` | Use basic authentication with username USER. The password will be prompted for. |
| `--silent` | Mute display of info headers in non-interactive mode. |

### Actions

Most actions support output either in human-readable text form (default) or as JSON by appending '.json' to the action
name. Addresses may be given in user-friendly address format, hex or base64 encoded. Blocks can be specified by hash in
hex or base64 format, by the height on the main chain, as 'latest' or as offset X from the latest block via 'latest-X'.
Transactions are understood in hex or base64 format of their hash. Peers may be given as their peer id in hex or peer
address.

Some features might not be available, depending on the consensus type your network node is using.

| Action | Description |
| --- | --- |
| `help` | Show usage instructions. |
| `account ADDR` | Display details for account with address `ADDR`. |
| `accounts` | List local accounts. |
| `accounts.create` | Create a new Nimiq Account and store it in the WalletStore of the Nimiq node. |
| `block BLOCK` | Display details of block `BLOCK`. |
| `constant CONST [VAL]` | Display value of constant `CONST`. If `VAL` is given, overrides constant `CONST` with value `VAL`.|
| `consensus.min_fee_per_byte [FEE]` | Read or change the current min fee per byte setting. |
| `log [TAG] [LEVEL]` | Set the log level for `TAG` to `LEVEL`. If `LEVEL` is omitted, 'verbose' is assumed. If `TAG` is omitted, '*' is assumed. |
| `mining` |  Display information on current mining settings and state. |
| `mining.enabled [VAL] ` | Read or change enabled state of miner. |
| `mining.threads [VAL]` | Read or change number of threads of miner. |
| `mining.hashrate` | Read the current hashrate of miner. |
| `mining.address` | Read the address the miner is mining to. |
| `mining.poolConnection` | Read the current connection state of the pool. |
| `mining.poolBalance` | Read the current balance that was confirmed and not yet payed out by the pool. |
| `mining.pool [VAL]` | Read or change the mining pool. Specify host:port to connect to a specific pool, true to connect to a previously specified pool and false to disconnect. |
| `mempool` | Display mempool stats. |
| `mempool.content [INCLUDE_TX]` | Display mempool content. If `INCLUDE_TX` is given, full transactions instead of transaction hashes are requested. |
| `peer PEER [ACTION]` | Display details about peer `PEER`. If `ACTION` is specified, invokes the named action on the peer. Currently supported actions include: connect, disconnect, ban, unban, fail |
| `peers` | List all known peer addresses and their current connection state. |
| `status` | Display the current status of the Nimiq node. |
| `transaction TX` | Display details about transaction `TX`. |
| `transaction BLOCK IDX` | Display details about transaction at index `IDX` in block `BLOCK`. |
| `transaction.receipt TX` | Display the transaction receipt for transaction `TX`. |
| `transaction.send SENDER RECIPIENT VALUE FEE [DATA]` | Create, sign and send a transaction with the given properties (value/fee given in NIM). The sending account must be a local account. |
| `transactions ADDR [LIMIT]` | Display at most `LIMIT` transactions involving address `ADDR`. |
