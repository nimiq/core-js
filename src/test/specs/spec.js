process.chdir('./dist');
process.env.NODE_PATH = '.';
require('module').Module._initPaths();

const Nimiq = require('node.js');
for(let i in Nimiq) global[i] = Nimiq[i];

global.Class = {
    register: clazz => {
        global[clazz.prototype.constructor.name] = clazz;
    }
};

require('./generic/DummyData.spec.js');
require('./generic/consensus/full/TestFullchain.spec.js');
