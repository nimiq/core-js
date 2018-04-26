# Nimiq Node.js Client

## Usage

### With a configuration file (recommended)

```bash
clients/nodejs/nimiq --config=CONFIG
```

Use the [sample configuration](../clients/nodejs/sample.conf) to get started.

### From the command line
```bash
clients/nodejs/nimiq --host=HOSTNAME --port=PORT --cert=SSL_CERT_FILE --key=SSL_KEY_FILE [options]
```

#### Configuration

| **Configuration** | **Description** |
| :--- | :--- |
| `--host=HOSTNAME` | Hostname of the Node.js client. |
| `--port=PORT` | Port to listen on for connections. |
| `--cert=SSL_CERT_FILE` | SSL certificate file for your domain. CN should match HOSTNAME. |
| `--key=SSL_KEY_FILE` | SSL private key file for your domain. |

#### Options

| **Options** | **Description** |
| :--- | :--- |
| `--help` | Show usage instructions. |
| `--log[=LEVEL]` | Configure global log level. |
| `--log-tag=TAG[:LEVEL]` | Configure log level for a specific tag. |
| `--miner[=THREADS]` | Activate mining on this node with THREADS parallel threads. |
| `--passive` | Do not actively connect to the network. |
| `--rpc[=PORT]` | Start JSON-RPC server on port PORT (default: 8648). |
| `--metrics[=PORT]` | Start Prometheus-compatible metrics server on port `PORT` (default: 8649).  |
| `--statistics[=INTERVAL]` | Output miner statistics every INTERVAL seconds. |
| `--type=TYPE` | Configure the consensus type, one of full (default), light or nano. |
| `--wallet-seed=SEED` | Initialize wallet using SEED as a wallet seed. |
| `--wallet-address=ADDRESS` | Initialize wallet using ADDRESS as a wallet address. |
| `--extra-data=EXTRA_DATA` | Extra data to add to every mined block. |
| `--network=NAME` | Configure the network to connect to, one of main (default), test, dev, or bounty. |
