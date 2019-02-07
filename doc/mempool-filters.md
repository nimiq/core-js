# Mempool filters

Mempool filters allow miners to specify which transactions they want to process.
These filters are intended and designed to combat transaction spam, not as a censorship tool.
All filters are disabled by default.
Transactions removed by these filters are not added to the mempool and not relayed to other peers.

## Filter rules

| Constant | Description |
| --- | --- |
| `MempoolFilter.FEE` | Minimum transaction fee (absolute, *not* per byte) |
| `MempoolFilter.VALUE` | Minimum transaction value |
| `MempoolFilter.TOTAL_VALUE` | Minimum transaction total value (value + fee) |
| `MempoolFilter.RECIPIENT_BALANCE` | Minimum balance in the recipient account after the transaction is applied. Applied regardless of whether the recipient account existed before this transaction or not. |
| `MempoolFilter.SENDER_BALANCE` | Minimum balance left in the sender account after the transaction is applied. Applied only if the transaction does not empty the sender account. |
| `MempoolFilter.CREATION_FEE` | Minimum fee for transactions that create a new account (absolute, *not* per byte) |
| `MempoolFilter.CREATION_VALUE` | Minimum value for transactions that create a new account. This corresponds to the minimum balance for new accounts. |
| `MempoolFilter.CONTRACT_FEE` | Minimum fee for transactions that create a new contract (absolute, *not* per byte) |
| `MempoolFilter.CONTRACT_VALUE` | Minimum value for transactions that create a new contract. This corresponds to the minimum balance for new contracts. |

All values are specified in *Luna* (0.00001 NIM).

## Usage

### Via config file
Add any combination of the filter constants above to the `constantOverrides` section in your config file.

```
constantOverrides: {
    "MempoolFilter.CREATION_VALUE": 20000,
    "MempoolFilter.CONTRACT_VALUE": 100000
}
```

### Via JSON-RPC client
Use the `constant` command to set any of the above filter constants to the desired value.
This will enable filters for the current session only and does *not* apply filters to transactions that are already in the mempool.

```
constant MempoolFilter.CREATION_VALUE 20000
```

