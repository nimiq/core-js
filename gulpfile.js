const gulp = require('gulp');
const babel = require('gulp-babel');
const browserify = require('browserify');
const buffer = require('vinyl-buffer');
const concat = require('gulp-concat');
const connect = require('gulp-connect');
const istanbul = require('istanbul-api');
const jasmine = require('gulp-jasmine-livereload-task');
const merge = require('merge2');
const replace = require('gulp-string-replace');
const source = require('vinyl-source-stream');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify-es').default;
const util = require('gulp-util');

const sources = {
    platform: {
        browser: [
            './src/main/platform/browser/Class.js',
            './src/main/platform/browser/utils/LogNative.js',
            './src/main/generic/utils/Log.js',
            './src/main/generic/utils/Observable.js',
            './src/main/generic/network/DataChannel.js',
            './src/main/platform/browser/crypto/CryptoLib.js',
            './src/main/platform/browser/network/webrtc/WebRtcFactory.js',
            './src/main/platform/browser/network/websocket/WebSocketFactory.js',
            './src/main/platform/browser/network/DnsUtils.js'
        ],
        offline: [
            './src/main/platform/browser/Class.js',
            './src/main/platform/browser/utils/LogNative.js',
            './src/main/generic/utils/Log.js',
            './src/main/generic/utils/Observable.js',
            './src/main/platform/browser/crypto/CryptoLib.js',
        ],
        node: [
            './src/main/platform/nodejs/utils/LogNative.js',
            './src/main/generic/utils/Log.js',
            './src/main/generic/utils/Observable.js',
            './src/main/generic/network/DataChannel.js',
            './src/main/platform/nodejs/crypto/CryptoLib.js',
            './src/main/platform/nodejs/network/webrtc/WebRtcFactory.js',
            './src/main/platform/nodejs/network/websocket/WebSocketFactory.js',
            './src/main/platform/nodejs/network/DnsUtils.js'
        ]
    },
    generic: [
        './src/main/generic/utils/ConstantHelper.js',
        './src/main/generic/utils/Services.js',
        './src/main/generic/utils/Timers.js',
        './src/main/generic/utils/Version.js',
        './src/main/generic/utils/Time.js',
        './src/main/generic/utils/array/ArrayUtils.js',
        './src/main/generic/utils/array/HashMap.js',
        './src/main/generic/utils/array/HashSet.js',
        './src/main/generic/utils/array/LimitHashSet.js',
        './src/main/generic/utils/array/InclusionHashSet.js',
        './src/main/generic/utils/array/LimitInclusionHashSet.js',
        './src/main/generic/utils/array/LimitIterable.js',
        './src/main/generic/utils/array/LinkedList.js',
        './src/main/generic/utils/array/UniqueLinkedList.js',
        './src/main/generic/utils/array/Queue.js',
        './src/main/generic/utils/array/UniqueQueue.js',
        './src/main/generic/utils/array/ThrottledQueue.js',
        './src/main/generic/utils/array/SortedList.js',
        './src/main/generic/utils/assert/Assert.js',
        './src/main/generic/utils/buffer/BufferUtils.js',
        './src/main/generic/utils/buffer/SerialBuffer.js',
        './src/main/generic/utils/synchronizer/Synchronizer.js',
        './src/main/generic/utils/synchronizer/MultiSynchronizer.js',
        './src/main/generic/utils/synchronizer/PrioritySynchronizer.js',
        './src/main/generic/utils/RateLimit.js',
        './src/main/generic/utils/IWorker.js',
        './src/main/generic/utils/WasmHelper.js',
        './src/main/generic/utils/crypto/CryptoWorker.js',
        './src/main/generic/utils/crypto/CryptoWorkerImpl.js',
        './src/main/generic/utils/crc/CRC32.js',
        './src/main/generic/utils/number/NumberUtils.js',
        './src/main/generic/utils/merkle/MerkleTree.js',
        './src/main/generic/utils/merkle/MerklePath.js',
        './src/main/generic/utils/merkle/MerkleProof.js',
        './src/main/generic/utils/platform/PlatformUtils.js',
        './src/main/generic/utils/string/StringUtils.js',
        './src/main/generic/consensus/Policy.js',
        './src/main/generic/consensus/base/primitive/Serializable.js',
        './src/main/generic/consensus/base/primitive/Hash.js',
        './src/main/generic/consensus/base/primitive/PrivateKey.js',
        './src/main/generic/consensus/base/primitive/PublicKey.js',
        './src/main/generic/consensus/base/primitive/KeyPair.js',
        './src/main/generic/consensus/base/primitive/RandomSecret.js',
        './src/main/generic/consensus/base/primitive/Signature.js',
        './src/main/generic/consensus/base/primitive/Commitment.js',
        './src/main/generic/consensus/base/primitive/CommitmentPair.js',
        './src/main/generic/consensus/base/primitive/PartialSignature.js',
        './src/main/generic/consensus/base/account/Address.js',
        './src/main/generic/consensus/base/account/Account.js',
        './src/main/generic/consensus/base/account/PrunedAccount.js',
        './src/main/generic/consensus/base/account/BasicAccount.js',
        './src/main/generic/consensus/base/account/Contract.js',
        './src/main/generic/consensus/base/account/HashedTimeLockedContract.js',
        './src/main/generic/consensus/base/account/VestingContract.js',
        './src/main/generic/consensus/base/account/tree/AccountsTreeNode.js',
        './src/main/generic/consensus/base/account/tree/AccountsTreeStore.js',
        './src/main/generic/consensus/base/account/tree/SynchronousAccountsTreeStore.js',
        './src/main/generic/consensus/base/account/tree/AccountsProof.js',
        './src/main/generic/consensus/base/account/tree/AccountsTreeChunk.js',
        './src/main/generic/consensus/base/account/tree/AccountsTree.js',
        './src/main/generic/consensus/base/account/tree/SynchronousAccountsTree.js',
        './src/main/generic/consensus/base/account/tree/PartialAccountsTree.js',
        './src/main/generic/consensus/base/account/Accounts.js',
        './src/main/generic/consensus/base/block/BlockHeader.js',
        './src/main/generic/consensus/base/block/BlockInterlink.js',
        './src/main/generic/consensus/base/block/BlockBody.js',
        './src/main/generic/consensus/base/block/BlockUtils.js',
        './src/main/generic/consensus/base/subscription/Subscription.js',
        './src/main/generic/consensus/base/transaction/Transaction.js',
        './src/main/generic/consensus/base/transaction/SignatureProof.js',
        './src/main/generic/consensus/base/transaction/BasicTransaction.js',
        './src/main/generic/consensus/base/transaction/ExtendedTransaction.js',
        './src/main/generic/consensus/base/transaction/TransactionsProof.js',
        './src/main/generic/consensus/base/transaction/TransactionCache.js',
        './src/main/generic/consensus/base/transaction/index/TransactionStoreEntry.js',
        './src/main/generic/consensus/base/transaction/index/TransactionStore.js',
        './src/main/generic/consensus/base/transaction/index/TransactionReceipt.js',
        './src/main/generic/consensus/base/block/Block.js',
        './src/main/generic/consensus/base/blockchain/IBlockchain.js',
        './src/main/generic/consensus/base/blockchain/BaseChain.js',
        './src/main/generic/consensus/base/blockchain/BlockChain.js',
        './src/main/generic/consensus/base/blockchain/HeaderChain.js',
        './src/main/generic/consensus/base/blockchain/ChainProof.js',
        './src/main/generic/consensus/base/blockchain/ChainData.js',
        './src/main/generic/consensus/base/blockchain/ChainDataStore.js',
        './src/main/generic/consensus/base/mempool/MempoolTransactionSet.js',
        './src/main/generic/consensus/base/mempool/Mempool.js',
        './src/main/generic/consensus/InvRequestManager.js',
        './src/main/generic/consensus/BaseConsensusAgent.js',
        './src/main/generic/consensus/BaseConsensus.js',
        './src/main/generic/consensus/full/FullChain.js',
        './src/main/generic/consensus/full/FullConsensusAgent.js',
        './src/main/generic/consensus/full/FullConsensus.js',
        './src/main/generic/consensus/light/LightChain.js',
        './src/main/generic/consensus/light/LightConsensusAgent.js',
        './src/main/generic/consensus/light/LightConsensus.js',
        './src/main/generic/consensus/light/PartialLightChain.js',
        './src/main/generic/consensus/nano/NanoChain.js',
        './src/main/generic/consensus/nano/NanoConsensusAgent.js',
        './src/main/generic/consensus/nano/NanoConsensus.js',
        './src/main/generic/consensus/nano/NanoMempool.js',
        './src/main/generic/consensus/ConsensusDB.js',
        './src/main/generic/consensus/Consensus.js',
        './src/main/generic/network/Protocol.js',
        './src/main/generic/network/message/Message.js',
        './src/main/generic/network/message/AddrMessage.js',
        './src/main/generic/network/message/BlockMessage.js',
        './src/main/generic/network/message/RawBlockMessage.js',
        './src/main/generic/network/message/GetAddrMessage.js',
        './src/main/generic/network/message/GetBlocksMessage.js',
        './src/main/generic/network/message/HeaderMessage.js',
        './src/main/generic/network/message/InventoryMessage.js',
        './src/main/generic/network/message/MempoolMessage.js',
        './src/main/generic/network/message/PingMessage.js',
        './src/main/generic/network/message/PongMessage.js',
        './src/main/generic/network/message/RejectMessage.js',
        './src/main/generic/network/message/SignalMessage.js',
        './src/main/generic/network/message/SubscribeMessage.js',
        './src/main/generic/network/message/TxMessage.js',
        './src/main/generic/network/message/VersionMessage.js',
        './src/main/generic/network/message/VerAckMessage.js',
        './src/main/generic/network/message/AccountsProofMessage.js',
        './src/main/generic/network/message/GetAccountsProofMessage.js',
        './src/main/generic/network/message/ChainProofMessage.js',
        './src/main/generic/network/message/GetChainProofMessage.js',
        './src/main/generic/network/message/AccountsTreeChunkMessage.js',
        './src/main/generic/network/message/GetAccountsTreeChunkMessage.js',
        './src/main/generic/network/message/TransactionsProofMessage.js',
        './src/main/generic/network/message/GetTransactionsProofMessage.js',
        './src/main/generic/network/message/GetTransactionReceiptsMessage.js',
        './src/main/generic/network/message/TransactionReceiptsMessage.js',
        './src/main/generic/network/message/GetBlockProofMessage.js',
        './src/main/generic/network/message/BlockProofMessage.js',
        './src/main/generic/network/message/GetHeadMessage.js',
        './src/main/generic/network/message/HeadMessage.js',
        './src/main/generic/network/message/MessageFactory.js',
        './src/main/generic/network/webrtc/WebRtcConnector.js',
        './src/main/generic/network/webrtc/WebRtcDataChannel.js',
        './src/main/generic/network/webrtc/WebRtcUtils.js',
        './src/main/generic/network/websocket/WebSocketConnector.js',
        './src/main/generic/network/websocket/WebSocketDataChannel.js',
        './src/main/generic/network/address/NetAddress.js',
        './src/main/generic/network/address/PeerId.js',
        './src/main/generic/network/address/PeerAddress.js',
        './src/main/generic/network/address/PeerAddressState.js',
        './src/main/generic/network/address/PeerAddressBook.js',
        './src/main/generic/consensus/GenesisConfig.js',
        './src/main/generic/network/connection/CloseType.js',
        './src/main/generic/network/connection/NetworkConnection.js',
        './src/main/generic/network/connection/PeerChannel.js',
        './src/main/generic/network/connection/NetworkAgent.js',
        './src/main/generic/network/connection/PeerConnectionStatistics.js',
        './src/main/generic/network/connection/PeerConnection.js',
        './src/main/generic/network/connection/SignalProcessor.js',
        './src/main/generic/network/connection/ConnectionPool.js',
        './src/main/generic/network/PeerScorer.js',
        './src/main/generic/network/NetworkConfig.js',
        './src/main/generic/network/Network.js',
        './src/main/generic/network/NetUtils.js',
        './src/main/generic/network/PeerKeyStore.js',
        './src/main/generic/network/Peer.js',
        './src/main/generic/miner/Miner.js',
        './src/main/generic/miner/BasePoolMiner.js',
        './src/main/generic/miner/SmartPoolMiner.js',
        './src/main/generic/miner/NanoPoolMiner.js',
        './src/main/generic/wallet/Wallet.js',
        './src/main/generic/wallet/MultiSigWallet.js',
        './src/main/generic/wallet/WalletStore.js',
        './src/main/generic/miner/MinerWorker.js',
        './src/main/generic/miner/MinerWorkerImpl.js',
        './src/main/generic/miner/MinerWorkerPool.js'
    ],
    offline: [
        './src/main/generic/utils/array/ArrayUtils.js',
        './src/main/generic/utils/assert/Assert.js',
        './src/main/generic/utils/buffer/BufferUtils.js',
        './src/main/generic/utils/buffer/SerialBuffer.js',
        './src/main/generic/utils/number/NumberUtils.js',
        './src/main/generic/utils/merkle/MerklePath.js',
        './src/main/generic/utils/platform/PlatformUtils.js',
        './src/main/generic/utils/string/StringUtils.js',
        './src/main/generic/consensus/Policy.js',
        './src/main/generic/consensus/base/primitive/Serializable.js',
        './src/main/generic/consensus/base/primitive/Hash.js',
        './src/main/generic/consensus/base/primitive/PrivateKey.js',
        './src/main/generic/consensus/base/primitive/PublicKey.js',
        './src/main/generic/consensus/base/primitive/KeyPair.js',
        './src/main/generic/consensus/base/primitive/RandomSecret.js',
        './src/main/generic/consensus/base/primitive/Signature.js',
        './src/main/generic/consensus/base/primitive/Commitment.js',
        './src/main/generic/consensus/base/primitive/CommitmentPair.js',
        './src/main/generic/consensus/base/primitive/PartialSignature.js',
        './src/main/generic/consensus/base/account/Address.js',
        './src/main/generic/consensus/base/account/Account.js',
        './src/main/generic/consensus/base/transaction/Transaction.js',
        './src/main/generic/consensus/base/transaction/SignatureProof.js',
        './src/main/generic/consensus/base/transaction/BasicTransaction.js',
        './src/main/generic/consensus/base/transaction/ExtendedTransaction.js',
        './src/main/generic/utils/IWorker.js',
        './src/main/generic/utils/WasmHelper.js',
        './src/main/generic/utils/crypto/CryptoWorker.js',
        './src/main/generic/consensus/GenesisConfigOffline.js'
    ],
    test: [
        'src/test/specs/**/*.spec.js'
    ],
    worker: [
        './src/main/platform/browser/Class.js',
        './src/main/generic/utils/platform/PlatformUtils.js',
        './src/main/platform/browser/utils/LogNative.js',
        './src/main/generic/utils/Log.js',
        './src/main/generic/utils/IWorker.js',
        './src/main/generic/utils/WasmHelper.js',
        './src/main/generic/utils/crypto/*.js',
        './src/main/generic/utils/number/*.js',
        './src/main/generic/utils/buffer/*.js',
        './src/main/generic/miner/MinerWorker*.js',

        './src/main/platform/browser/worker/GenesisConfig.js',
        './src/main/generic/utils/array/ArrayUtils.js',
        './src/main/generic/utils/assert/Assert.js',
        './src/main/generic/utils/buffer/SerialBuffer.js',
        './src/main/generic/utils/merkle/MerkleTree.js',
        './src/main/generic/utils/merkle/MerklePath.js',
        './src/main/generic/consensus/Policy.js',
        './src/main/generic/consensus/base/primitive/Serializable.js',
        './src/main/generic/consensus/base/primitive/Hash.js',
        './src/main/generic/consensus/base/primitive/PublicKey.js',
        './src/main/generic/consensus/base/primitive/Signature.js',
        './src/main/generic/consensus/base/account/Address.js',
        './src/main/generic/consensus/base/account/Account.js',
        './src/main/generic/consensus/base/account/PrunedAccount.js',
        './src/main/generic/consensus/base/account/BasicAccount.js',
        './src/main/generic/consensus/base/account/Contract.js',
        './src/main/generic/consensus/base/account/HashedTimeLockedContract.js',
        './src/main/generic/consensus/base/account/VestingContract.js',
        './src/main/generic/consensus/base/block/BlockHeader.js',
        './src/main/generic/consensus/base/block/BlockInterlink.js',
        './src/main/generic/consensus/base/block/BlockBody.js',
        './src/main/generic/consensus/base/block/BlockUtils.js',
        './src/main/generic/consensus/base/block/Block.js',
        './src/main/generic/consensus/base/transaction/Transaction.js',
        './src/main/generic/consensus/base/transaction/SignatureProof.js',
        './src/main/generic/consensus/base/transaction/BasicTransaction.js',
        './src/main/generic/consensus/base/transaction/ExtendedTransaction.js',
    ],
    sectest: [
        'sectests/**/*.sectest.js'
    ],
    all: [
        './src/main/**/*.js',
        '!./src/main/platform/browser/index.prefix.js',
        '!./src/main/platform/browser/index.suffix.js',
        './src/test/**/*.js',
        '!./src/**/node_modules/**/*.js'
    ]
};

const dependencies = ['./node_modules/@nimiq/jungle-db/dist/indexeddb.js']; // external dependencies

const babel_config = {
    plugins: [['transform-runtime', {
        'polyfill': false
    }], 'transform-es2015-modules-commonjs'],
    presets: ['es2016', 'es2017']
};

const babel_loader = {
    plugins: [['transform-runtime', {
        'polyfill': false
    }]],
    presets: ['env']
};

const uglify_config = {
    ie8: true,
    keep_fnames: true,
    ecma: 8,
    warnings: true,
    mangle: {
        keep_classnames: true,
        safari10: true
    },
    output: {
        safari10: true
    },
    compress: {
        sequences: false,
        typeofs: false,
        keep_infinity: true
    }
};

const uglify_babel = {
    ie8: true,
    keep_fnames: true,
    ecma: 5,
    warnings: true,
    mangle: {
        keep_classnames: true,
        safari10: true
    },
    compress: {
        sequences: false,
        typeofs: false,
        keep_infinity: true
    }
};

gulp.task('build-worker', function () {
    return gulp.src(sources.worker)
        .pipe(sourcemaps.init())
        .pipe(concat('worker.js'))
        .pipe(uglify())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
        .pipe(connect.reload());
});

gulp.task('build-istanbul', function () {
    return new Promise((callback) => {
        istanbul.instrument.run(istanbul.config.loadObject(), {input: './src/main', output: './.istanbul/src/main'}, callback);
    });
});

const BROWSER_SOURCES = [
    ...dependencies, // external dependencies
    './src/main/platform/browser/index.prefix.js',
    ...sources.platform.browser,
    ...sources.generic,
    './src/main/platform/browser/index.suffix.js'
];

gulp.task('build-web-babel', ['build-worker'], function () {
    return merge(
        browserify([], {
            require: [
                'babel-runtime/core-js/array/from',
                'babel-runtime/core-js/object/values',
                'babel-runtime/core-js/object/freeze',
                'babel-runtime/core-js/object/keys',
                'babel-runtime/core-js/json/stringify',
                'babel-runtime/core-js/number/is-integer',
                'babel-runtime/core-js/number/max-safe-integer',
                'babel-runtime/core-js/math/clz32',
                'babel-runtime/core-js/math/fround',
                'babel-runtime/core-js/math/imul',
                'babel-runtime/core-js/math/trunc',
                'babel-runtime/core-js/promise',
                'babel-runtime/core-js/get-iterator',
                'babel-runtime/regenerator',
                'babel-runtime/helpers/asyncToGenerator'
            ]
        }).bundle()
            .pipe(source('babel.js'))
            .pipe(buffer()),
        gulp.src(BROWSER_SOURCES, {base: '.'})
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(concat('web.js'))
            .pipe(babel(babel_config)))
        .pipe(sourcemaps.init())
        .pipe(concat('web-babel.js'))
        .pipe(uglify(uglify_babel))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

gulp.task('build-web', ['build-worker'], function () {
    return gulp.src(BROWSER_SOURCES, {base: '.'})
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(concat('web.js'))
        .pipe(uglify(uglify_config))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
        .pipe(connect.reload());
});

const OFFLINE_SOURCES = [
    './src/main/platform/browser/index.prefix.js',
    ...sources.platform.offline,
    ...sources.offline,
    './src/main/platform/browser/index.suffix.js'
];

gulp.task('build-offline-babel', function () {
    return merge(
        browserify([], {
            require: [
                'babel-runtime/core-js/array/from',
                'babel-runtime/core-js/object/values',
                'babel-runtime/core-js/object/freeze',
                'babel-runtime/core-js/object/keys',
                'babel-runtime/core-js/json/stringify',
                'babel-runtime/core-js/number/is-integer',
                'babel-runtime/core-js/number/max-safe-integer',
                'babel-runtime/core-js/math/clz32',
                'babel-runtime/core-js/math/fround',
                'babel-runtime/core-js/math/imul',
                'babel-runtime/core-js/math/trunc',
                'babel-runtime/core-js/promise',
                'babel-runtime/core-js/get-iterator',
                'babel-runtime/regenerator',
                'babel-runtime/helpers/asyncToGenerator'
            ]
        }).bundle()
            .pipe(source('babel.js'))
            .pipe(buffer()),
        gulp.src(OFFLINE_SOURCES, {base: '.'})
            .pipe(sourcemaps.init({loadMaps: true}))
            .pipe(concat('web-offline.js'))
            .pipe(babel(babel_config)))
        .pipe(sourcemaps.init())
        .pipe(concat('web-offline-babel.js'))
        .pipe(uglify(uglify_babel))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

gulp.task('build-offline', function () {
    return gulp.src(OFFLINE_SOURCES, {base: '.'})
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(concat('web-offline.js'))
        .pipe(uglify(uglify_config))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
        .pipe(connect.reload());
});

gulp.task('build-web-istanbul', ['build-worker', 'build-istanbul'], function () {
    return gulp.src(BROWSER_SOURCES.map(f => f.indexOf('./src/main') === 0 ? `./.istanbul/${f}` : f), {base: '.'})
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(concat('web-istanbul.js'))
        .pipe(uglify(uglify_config))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
        .pipe(connect.reload());
});

gulp.task('build-loader', function () {
    return merge(
        browserify([], {
            require: [
                'babel-runtime/regenerator',
                'babel-runtime/helpers/asyncToGenerator',
                'babel-runtime/helpers/classCallCheck',
                'babel-runtime/helpers/createClass'
            ]
        }).bundle()
            .pipe(source('babel-runtime.js'))
            .pipe(buffer())
            .pipe(sourcemaps.init()),
        gulp.src(['./src/main/platform/browser/utils/WindowDetector.js', './src/main/platform/browser/Nimiq.js'])
            .pipe(sourcemaps.init())
            .pipe(babel(babel_loader)))
        .pipe(concat('nimiq.js'))
        .pipe(uglify(uglify_config))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

const NODE_SOURCES = [
    './src/main/platform/nodejs/index.prefix.js',
    ...sources.platform.node,
    ...sources.generic,
    './src/main/platform/nodejs/index.suffix.js'
];

gulp.task('build-node', function () {
    gulp.src(['build/Release/nimiq_node.node']).pipe(gulp.dest('dist'));
    return gulp.src(NODE_SOURCES)
        .pipe(sourcemaps.init())
        .pipe(concat('node.js'))
        //.pipe(uglify(uglify_config))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

gulp.task('build-node-istanbul', ['build-istanbul'], function () {
    gulp.src(['build/Release/nimiq_node.node']).pipe(gulp.dest('dist'));
    return gulp.src(NODE_SOURCES.map(f => `./.istanbul/${f}`))
        .pipe(sourcemaps.init())
        .pipe(concat('node-istanbul.js'))
        .pipe(uglify(uglify_config))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

const RELEASE_SOURCES = [
    'dist/VERSION',
    process.execPath
];

const RELEASE_LIB = [
    'dist/node.*',
    'dist/worker-*',
    'build/Release/nimiq_node_generic.node'
];

gulp.task('prepare-packages', ['build-node'], function () {
    gulp.src(RELEASE_SOURCES).pipe(gulp.dest('packaging/BUILD'));
    gulp.src(['clients/nodejs/sample.conf']).pipe(gulp.dest('packaging/BUILD/fakeroot/etc/nimiq'));
    gulp.src(['package.json']).pipe(replace('"architecture": "none"', `"architecture": "${util.env.architecture}"`)).pipe(gulp.dest('packaging/BUILD'));
    gulp.src(['clients/nodejs/nimiq']).pipe(replace('node "\\$SCRIPT_PATH/index.js"', '/usr/share/nimiq/{{ cli_entrypoint }}')).pipe(gulp.dest('packaging/BUILD'));
    gulp.src(['clients/nodejs/index.js']).pipe(replace('../../dist/node.js', './lib/node.js')).pipe(gulp.dest('packaging/BUILD'));
    gulp.src(['clients/nodejs/modules/*.js']).pipe(replace('../../../dist/node.js', '../lib/node.js')).pipe(gulp.dest('packaging/BUILD/modules'));
    gulp.src(['node_modules/**/*'], {base: '.', dot: true }).pipe(gulp.dest('packaging/BUILD'));
    gulp.src(RELEASE_LIB).pipe(gulp.dest('packaging/BUILD/lib'));
});

gulp.task('test', ['watch'], function () {
    gulp.run(jasmine({
        files: ['dist/web.js'].concat(sources.test)
    }));
});

gulp.task('test-babel', ['watch'], function () {
    gulp.run(jasmine({
        files: ['dist/web-babel.js'].concat(sources.test)
    }));
});

gulp.task('sectest', ['watch'], function () {
    gulp.run(jasmine({
        files: ['dist/web.js'].concat(sources.sectest)
    }));
});

gulp.task('sectest-babel', ['watch'], function () {
    gulp.run(jasmine({
        files: ['dist/web-babel.js'].concat(sources.sectest)
    }));
});

gulp.task('eslint', function () {
    const eslint = require('gulp-eslint');
    return gulp.src(sources.all)
        .pipe(eslint({quiet: true}))
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('watch', ['build-web'], function () {
    return gulp.watch(sources.all, ['build-web']);
});

gulp.task('serve', ['watch'], function () {
    connect.server({
        livereload: true,
        serverInit: function () {
            util.log(util.colors.blue('Nimiq Blockchain Cockpit will be at http://localhost:8080/clients/browser/'));
        }
    });
});

gulp.task('build', ['build-web', 'build-web-babel', 'build-web-istanbul', 'build-offline', 'build-offline-babel', 'build-loader', 'build-node', 'build-node-istanbul']);

gulp.task('default', ['build', 'serve']);
