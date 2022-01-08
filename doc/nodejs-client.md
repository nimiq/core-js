# Nimiq Node.js Client

## Usage

### With a configuration file (recommended)

```bash
clients/nodejs/nimiq --config=CONFIG
```

Use the [sample configuration](../clients/nodejs/sample.conf) to get started.
Use of a configuration file is recommended because it gives access to more options than the command line interface.

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
| `--protocol=TYPE` | The protocol to be used. Available protocols are: wss (WebSocket Secure, requires a FQDN, port, and SSL certificate; default), ws (WebSocket, only requires public IP/FQDN and port), dumb (discouraged as the number of dumb nodes might be limited) |

#### Options

| **Options** | **Description** |
| :--- | :--- |
| `--help` | Show usage instructions. |
| `--log[=LEVEL]` | Configure global log level. Not specifying a level will enable verbose log output. |
| `--miner[=THREADS]` | Activate mining on this node with `THREADS` parallel threads. |
| `--pool=SERVER:PORT` | Mine shares for the mining pool with address `SERVER:PORT` |
| `--device-data=DATA_JSON` | Pass information about this device to the mining pool. Takes a valid JSON string, the format of which is defined by the pool operator. Only used when registering for a pool. |
| `--passive` | Do not actively connect to the network and do not wait for connection establishment. |
| `--rpc[=PORT]` | Start JSON-RPC server on port `PORT` (default: 8648). |
| `--metrics[=PORT[:PASSWORD]]` | Start Prometheus-compatible metrics server on port `PORT` (default: 8649). If `PASSWORD` is specified, it is required to be used for username "metrics" via Basic Authentication. |
| `--ui[=PORT]` | Serve a UI on port `PORT` (default: 8650). The UI will be reachable at localhost:`PORT`. |
| `--statistics[=INTERVAL]` | Output miner statistics every `INTERVAL` seconds. |
| `--type=TYPE` | Configure the consensus type, one of full (default), light, nano or pico. |
| `--volatile` | Run in volatile mode. Consensus state is kept in memory only and not written to disk. |
| `--reverse-proxy[=PORT[,IP]]` | Put the client behind a reverse proxy running on `PORT`,`IP` (default: 8444,::ffff:127.0.0.1) |
| `--wallet-seed=SEED` | Initialize wallet using `SEED` as a wallet seed. |
| `--wallet-address=ADDRESS` | Initialize wallet using `ADDRESS` as a wallet address. The wallet cannot be used to sign transactions when using this option. |
| `--extra-data=EXTRA_DATA` | Extra data to add to every mined block. |
| `--network=NAME` | Configure the network to connect to, one of main (default), test, or dev. |
