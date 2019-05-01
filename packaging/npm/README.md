# Nimiq Blockchain [![Build Status](https://travis-ci.org/nimiq-network/core.svg)](https://travis-ci.org/nimiq-network/core)

**[Nimiq](https://nimiq.com/)** is a frictionless payment protocol for the web.

## Resources

- [Nimiq White Paper](https://medium.com/nimiq-network/nimiq-a-peer-to-peer-payment-protocol-native-to-the-web-ffd324bb084): High-level introduction of the Nimiq payment protocol.
- [Nimiq Developer Reference](https://nimiq-network.github.io/developer-reference/): Details of the protocol architecture.
- [Core API Documentation](https://doc.esdoc.org/github.com/nimiq/core-js/): Documentation of the Nimiq Core library API.
- [Node.js Client Documentation](doc/nodejs-client.md): Usage and configuration documentation for the Nimiq Node.js Client.
- [JSON-RPC Client Documentation](doc/json-rpc-client.md): Usage instructions for the Nimiq JSON-RPC Client.
- [Docker Documentation](doc/docker.md): Instuctions on setting up a Nimiq Node using Docker.

## Demo
Check out our [Testnet](https://nimiq-testnet.com).

## Packages
### Prebuilt binary packages
For users looking to run a standalone Nimiq node (which is also capable of mining), see our [Downloads page](https://nimiq.com/#downloads) for installable Linux and Windows binary packages.

### NPM Packages
For developers looking to include Nimiq support on their applications, there are two npm packages available:

- [`@nimiq/core`](https://www.npmjs.com/package/@nimiq/core): Module for use in node.js applications.
- [`@nimiq/core-web`](https://www.npmjs.com/package/@nimiq/core-web): Module for use in client-side (browser) applications.

## Web Developers
### Simple Web Application on top of Nimiq
A good way to get started is to have a look at [the most simple web application on top of the Nimiq Blockchain](https://demo.nimiq.com/).

### Getting Started

Import `Nimiq` as an ES6 module:

```javascript
// With a package.json-aware module loader:
import Nimiq from '@nimiq/core-web';

// Otherwise:
import Nimiq from 'node_modules/@nimiq/core-web/web.esm.js';
```

To use Nimiq's cryptographic functions (for hashing, signing, derivation),
you have to make the following files from this package available to the browser
(for e.g. Vue, this means copying them into the `public` folder, or getting them
otherwise into the output directory):

```text
worker.js
worker-js.js
worker-wasm.js
worker-wasm.wasm
```

You can then load the Nimiq worker by calling `Nimiq.load()` with the URL of the folder containing the files:

```javascript
// Important: must be a full URL, a trailing slash is required.
const workerURL = location.origin + '/assets/nimiq/';

Nimiq.load(workerURL).then(async function() {
    // All Nimiq functionality is available here.
});
```

### Using a regular &lt;script&gt; tag

Include the `nimiq.js` file from this package into your project:

```html
<script src="node_modules/@nimiq/core-web/nimiq.js"></script>
```

If you do not need networking support, you can also use the smaller offline build:

```javascript
Nimiq.loadOffline().then(...);
```

## Contribute

If you'd like to contribute to the development of Nimiq please follow our [Code of Conduct](/.github/CODE_OF_CONDUCT.md) and [Contributing Guidelines](/.github/CONTRIBUTING.md).

## License

This project is under the [Apache License 2.0](./LICENSE.md).
