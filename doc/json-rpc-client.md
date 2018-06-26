# JSON-RPC Client

## Usage

`node remote.js [options] action [args]`

### Options

| Option | Description |
| --- | --- |
| `--host=HOST` | Define hostname or IP address of Nimiq JSON-RPC server to connect to. Defaults to local host.  |
| `--port=PORT` | Define port corresponding to HOST. Defaults to 8648. |
| `--user=USER` | Use basic authentication with username USER. The password will be prompted for. |

### Actions

Most actions support output either in human-readable text form (default) or as JSON by appending '.json' to the action name. Addresses may be given in user- friendly address format, hex or base64 encoded. Blocks can be specified by hash in hex or base64 format or by the height on the main chain. Transactions are understood in hex or base64 format of their hash. Peers may be given as their peer id in hex or peer address. Values and fees are understood to be given in NIM.

| Action | Description |
| --- | --- |
| `account ADDR` | Display details for account with address ADDR. |
| `accounts` | List local accounts. |
| `block BLOCK` | Display details of block BLOCK. |
| `constant CONST [VAL]` | Display value of constant CONST. If VAL is given, overrides constant const with value VAL.|
| `mining` |  Display information on current mining settings. |
| `mining.enabled [VAL] ` | Read or change enabled state of miner. |
| `mining.threads [VAL]` | Read or change number of threads of miner. |
| `peer PEER [ACTION]` | Display details about peer PEER. If ACTION is specified, invokes the named action on the peer. Currently supported actions include: connect, disconnect, ban, unban, fail |
| `peers` | List all known peer addresses and their current connection state. |
| `transaction TX` | Display details about transaction TX. |
| `transaction BLOCK IDX` | Display details about transaction at index IDX inblock `BLOCK`. |
| `transaction.receipt TX` | Display the transaction receipt for transaction TX. |
| `transaction.send SENDER RECIPIENT VALUE FEE [DATA]` | Create, sign and send a transaction with the given properties (value/fee given in NIM). The sending account must be a local account. |
| `transactions ADDR [LIMIT]` | Display at most LIMIT transactions involving address ADDR. |
| `mempool` | Display mempool stats. |
| `mempool.content [INCLUDE_TX]` | Display mempool content. If INCLUDE_TX is given, full transactions instead of transaction hashes are requested. |
| `consensus.min_fee_per_byte [FEE]` | Read or change the current min fee per byte setting. |
