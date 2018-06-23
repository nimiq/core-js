const argv = require('minimist')(process.argv.slice(2));
const Nimiq = require('../../dist/node.js');
const {Log} = Nimiq;
const fs = require('fs');
const stun = require('stun');
const dns = require('dns');
const http = require('http');
const os = require('os');
const rl = require('readline').createInterface({input: process.stdin, output: process.stdout});
const json5 = require('json5');
const json5writer = require('json5-writer');

const TAG = 'Setup';
const SERVICE_HOST = 'setup.nimiq-network.com:18442';
const NIMIQ_SETUP_COMMAND = process.env._NIMIQ_SETUP_COMMAND || 'node setup.js';

function printHelp() {
    console.log(
        'Nimiq NodeJS client setup utility\n' +
        '\n' +
        'Usage:\n' +
        `    ${NIMIQ_SETUP_COMMAND} init|reconfigure [options]\n` +
        '\n' +
        'Options:\n' +
        '  --config=FILE              Configration file to create or reconfigure.\n' +
        '  --help                     Show this usage instructions.\n');

    process.exit(0);
}

function normalizeIp(ip) {
    return Nimiq.NetUtils.bytesToIp(Nimiq.NetUtils.ipToBytes(ip));
}

function stunSelfResolve(attempt = 0) {
    const { STUN_BINDING_REQUEST, STUN_BINDING_RESPONSE, STUN_ATTR_XOR_MAPPED_ADDRESS } = stun.constants;
    return new Promise((resolve, fail) => {
        const server = stun.createServer();
        let timeout;
        if (attempt >= 3) {
            timeout = setTimeout(fail, 2000);
        } else {
            timeout = setTimeout(() => {
                stunSelfResolve(attempt + 1).then(resolve, fail);
            }, 2000);
        }
        server.once('bindingResponse', stunMsg => {
            resolve(stunMsg.getAttribute(STUN_ATTR_XOR_MAPPED_ADDRESS).value.address);
            clearTimeout(timeout);
            server.close();
        });
        server.send(stun.createMessage(STUN_BINDING_REQUEST), 19302, 'stun.nimiq-network.com');
    });
}

function dnsreverse(ip) {
    return new Promise((resolve, fail) => {
        dns.reverse(ip, (err, hostnames) => {
            if (err) fail(err);
            else resolve(hostnames);
        });
    });
}

function dnsresolve(name) {
    return new Promise((resolve, fail) => {
        dns.resolve(name, (err, ips) => {
            if (err) fail(err);
            else resolve(ips.map(normalize));
        });
    });
}

function isAmazon(rdns) {
    return rdns && !!rdns.match(/amazonaws\.com$/);
}

function isGoogle(rdns) {
    return rdns && !!rdns.match(/googleusercontent\.com$/);
}

if (argv.help || !argv._ || argv._.length != 1) {
    printHelp();
}

const command = argv._[0];
let init = false, reconfigure = false;
switch(command) {
    case 'init': init = true; break;
    case 'reconfigure': reconfigure = true; break;
    default: printHelp();
}

if (!argv.config) {
    // Guess config file name
    for(const candidate of ['nimiq.conf', 'config.json', 'miner.conf', 'local.conf', '/etc/nimiq/nimiq.conf']) {
        if (fs.existsSync(candidate)) {
            Log.w(TAG, `Config file was not specified via --config option, will work with ${candidate}`);
            argv.config = candidate;
            break;
        }
    }
}

if (init) {
    // Init without config file => create nimiq.conf in current dir
    if (!argv.config) argv.config = 'nimiq.conf';
    Log.v(TAG, `Will create initial configuration in file ${argv.config}`);
}

if (!argv.config) {
    Log.e(TAG, 'No config file specified and unable to automatically discover it, use --config option');
    printHelp();
}

function mini204(port) {
    try {
        return http.createServer((req, res) => {res.statusCode = 204; res.end();}).listen(port).on('error', () => {});
    } catch (e) {
        return {close: function(){}};
    }
}

function fetch(url) {
    return new Promise((resolve, fail) => {
        http.get(url, (res) => {
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => { resolve(rawData); });
        }).on('error', e => fail(e));
    });
}

async function work() {
    const data = {};

    if (reconfigure) {
        if (!fs.existsSync(argv.config)) {
            Log.e(TAG, `Config file does not exist: ${argv.config}`);
            return;
        }
        Log.i(TAG, `Will reconfigure file ${argv.config}`);

        // Read current information from config file
        const oldConfig = json5.parse(fs.readFileSync(argv.config));
        data.oldHost = oldConfig.host;
        data.oldTlsCert = oldConfig.tls ? oldConfig.tls.cert : undefined;
        data.oldTlsKey = oldConfig.tls ? oldConfig.tls.key : undefined;
        data.oldPort = oldConfig.port;

        if (oldConfig.dumb) {
            data.oldDumb = oldConfig.dumb;
            Log.i(TAG, 'Configuration file was set to dumb mode, ignoring');
        }
    }

    Log.i(TAG, 'Analyzing network configuration, this may take a few seconds.');

    // Gather public ip via STUN
    try {
        data.stunIp = normalizeIp(await stunSelfResolve());
    } catch (e) {
        Log.w(TAG, 'Failed to connect to stun.nimiq-network.com, are you connected to the internet?');
    }

    // Gather open ports and public IP via service
    // TODO: Add UPnP here if we notice we run behind a NAT (checked later on anyway)
    const servers = {
        80: mini204(80),
        8442: mini204(8442),
        8443: mini204(8443)
    };
    const askForOldPort = data.oldPort && !Object.keys(servers).includes(data.oldPort);
    if (askForOldPort) servers[data.oldPort] = mini204(data.oldPort);
    try {
        data.serviceInfo = JSON.parse(await fetch(`http://${SERVICE_HOST}/${askForOldPort ? data.oldPort : ''}`));
        for(const port of Object.keys(servers)) {
            data.serviceInfo.ports[port].wasListening = !!servers[port].listening;
        }
    } catch (e) {
        Log.w(TAG, `Failed to connect to ${SERVICE_HOST}, are you connected to the internet?`);
    }
    for(const port of Object.keys(servers)) {
        servers[port].close();
    }

    if (!data.serviceInfo && !data.stunIp) {
        Log.e(TAG, 'Failed to discover your public IP address, are you connected to the internet?');
        return;
    }

    if (data.serviceInfo && data.serviceInfo.ip && data.stunIp && data.serviceInfo.ip !== data.stunIp) {
        Log.v(TAG, `Service and STUN discovered IP addresses mismatch, will continue with ${data.stunIp}`);
        data.publicIp = data.stunIp;
    } else if (data.serviceInfo && data.serviceInfo.ip) {
        data.publicIp = data.serviceInfo.ip;
    } else if (data.stunIp) {
        data.publicIp = data.stunIp;
    }

    // Check reverse dns
    try {
        data.publicIpReverseDns = (await dnsreverse(data.publicIp))[0];
    } catch (e) {}

    // Gather local ips
    const ifaces = os.networkInterfaces();
    data.localIps = [];
    for(const name of Object.keys(ifaces)) {
        for(const addr of ifaces[name]) {
            if (addr.family == 'IPv4' && !Nimiq.NetUtils.isPrivateIP(addr.address)) {
                data.localIps.push(normalizeIp(addr.address));
            }
        }
    }

    data.isBehindNat = !data.localIps.includes(data.publicIp);
    try {
        if (data.oldHost) data.oldHostResolvesCorrectly = Nimiq.NetUtils.isIPv4Address(data.oldHost) || Nimiq.NetUtils.isIPv6Address(data.oldHost) || (await dnsresolve(data.oldHost)).includes(data.publicIp);
    } catch (e) {
        Log.w(TAG, `Hostname ${data.oldHost} from previous configuration seemed invalid, ignoring`);
    }

    // Check if ports publicly reachable
    data.workingPorts = [];
    if (data.serviceInfo && data.serviceInfo.ports) {
        for(const port of Object.keys(data.serviceInfo.ports)) {
            if (data.serviceInfo.ports[port].httpStatusCode === 204) {
                // Port very likely reached our server that responded with 204
                data.workingPorts.push(parseInt(port));
            } else if (!data.serviceInfo.ports[port].wasListening && data.serviceInfo.ports[port].socketReady) {
                // Port very likely was passed through to this node, but another service on this host was occupying the port
                data.workingPorts.push(parseInt(port));
            }
        }
    }

    if (data.workingPorts.includes(data.oldPort)) {
        // Old port is still working, so we can just continue using it
        Log.v(TAG, `Will continue to use port ${data.oldPort} from previous configuration`);
        data.port = data.oldPort;
        data.useTls = !!data.oldTlsCert;
    } else if (data.workingPorts.includes(8442) || data.workingPorts.includes(8443)) {
        // Our main ports work, continue with them
        data.useTls = !!data.oldTlsCert;
        data.port = data.useTls ? (data.workingPorts.includes(8443) ? 8443 : 8442) : (data.workingPorts.includes(8442) ? 8442 : 8443);
        Log.v(TAG, `Will use port ${data.port} for network interaction`);
    } else {
        // Ports closed, ask to fix
        console.log('');
        if (data.isBehindNat) {
            if (isAmazon(data.publicIpReverseDns)) {
                console.log('It appears you are running in an improperly configured Amazon EC2 instance. You need to update your EC2 security group settings to use all features of Nimiq. Check our instructions at https://nimiq.com/setup/#aws');
            } else if (isGoogle(data.publicIpReverseDns)) {
                console.log('It appears you are running in an improperly configured Google Compute Engine. You need to update your Google Cloud firewall rules to use all features of Nimiq. Check our instructions at https://nimiq.com/setup/#gce');
            } else {
                console.log('It appears you are running behind a NAT. You need to update the configuration of your router or virtual network to use all features of Nimiq. Check our instructions at https://nimiq.com/setup/#nat');
            }
        } else {
            console.log('It appears you are using a firewall on your system. Please configure the firewall to allow incoming connections to ports 80, 8442 and 8443');
        }
        const res = await new Promise((resolve) => {
            rl.question('Press enter once you updated your configuration or type \'dumb\' to run a limited node: ', resolve);
        });
        console.log('');
        if (res !== 'dumb') {
            Log.i(TAG, 'Restarting setup utility...');
            return work();
        }
        Log.i(TAG, `Will configure the system to run in limited 'dumb' mode. Please use '${NIMIQ_SETUP_COMMAND} reconfigure --config=${argv.config}' once you changed your network configuration.`);
        data.useDumb = true;
    }

    if (data.useTls) {
        Log.v(`Will continue to use TLS certficate ${data.oldTlsCert} from previous configuration`);
        data.tlsCert = data.oldTlsCert;
        data.tlsKey = data.oldTlsKey;
    }

    if (data.useTls && data.oldHostResolvesCorrectly) {
        Log.v(`Will continue to use hostname ${data.oldHost} from previous configuration`);
        data.host = data.oldHost;
    }

    if (data.useTls && !data.host) {
        // TODO: Detect hostname from tls certificate
    }

    if (!data.host) {
        // We cannot use tls without a proper certificate and hostname
        data.useTls = false;
        data.host = data.publicIp;
    }

    // TODO: Write out config file
    let configText = fs.existsSync(argv.config) ? fs.readFileSync(argv.config, 'utf-8') : '{}';
    configText = configText.replace('\n    //protocol', '\n    protocol');
    if (!data.useDumb) {
        configText = configText.replace('\n    //port', '\n    port').replace('\n    //host', '\n    host');
    }
    let config;
    try {
        config = json5.parse(configText);
    } catch (e) {
        Log.e(TAG, 'Existing config file is invalid, can\'t update');
        return;
    }
    if (data.useDumb) {
        config.protocol = 'dumb';
    } else if (data.useTls) {
        config.tls = {
            cert: data.tlsCert,
            key: data.tlsKey
        };
        config.protocol = 'wss';
        config.port = data.port;
        config.host = data.host;
    } else {
        config.protocol = 'ws';
        config.port = data.port;
        config.host = data.host;
    }
    const newConfigWriter = json5writer.load(configText);
    newConfigWriter.write(config);
    fs.writeFileSync(argv.config, newConfigWriter.toSource(), 'utf-8');
}
work().catch(console.log).then(() => rl.close());
