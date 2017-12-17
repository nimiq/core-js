process.chdir('./dist');
process.env.NODE_PATH = '.';
require('module').Module._initPaths();

const Nimiq = require(process.env.USE_ISTANBUL ? 'node-istanbul.js' : 'node.js');
for (let i in Nimiq) global[i] = Nimiq[i];

global.Class = {
    register: clazz => {
        global[clazz.prototype.constructor.name] = clazz;
    }
};

require('./generic/DummyData.spec.js');
require('./generic/TestUtils.spec.js');
require('./generic/consensus/full/TestFullchain.spec.js');

if (process.env.USE_ISTANBUL) {
    jasmine.getEnv().addReporter(/** @type {Reporter} */ {
        jasmineDone() {
            const istanbul = require('istanbul-api');
            const reporter = istanbul.createReporter(istanbul.config.loadObject({reporting: {dir: '../coverage'}}));
            const map = require('istanbul-lib-coverage').createCoverageMap(__coverage__);
            reporter.addAll(['text', 'lcov', 'html']);
            reporter.write(map);
        }
    });
}
