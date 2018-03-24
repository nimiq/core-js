class ConstantHelper {
    constructor() {
        this._originalValues = new Map();
    }

    static get instance() {
        if (!ConstantHelper._instance) {
            ConstantHelper._instance = new ConstantHelper();
        }
        return ConstantHelper._instance;
    }

    /**
     * @param {string} constant
     * @return {boolean}
     */
    isConstant(constant) {
        if (constant.indexOf('.') < 1) return false;
        const clazz = constant.split('.', 2)[0];
        constant = constant.split('.', 2)[1];
        if (constant.startsWith('_')) return false;
        if (constant.toUpperCase() !== constant) return false;
        if (!(clazz in Class.scope)) return false;
        if (!Class.scope[clazz]) return false;
        if (!Class.scope[clazz].hasOwnProperty) return false;
        if (!Class.scope[clazz].hasOwnProperty(constant)) return false;
        if (!Object.keys(Class.scope[clazz]).includes(constant)) return false;
        if (typeof Class.scope[clazz][constant] !== 'number') return false;
        return true;
    }

    /**
     * @param {string} constant
     */
    _ensureIsConstant(constant) {
        if (!this.isConstant(constant)) {
            throw new Error(`${constant} is not a numerical constant.`);
        }
    }

    /**
     * @param {string} constant
     * @returns {number}
     */
    get(constant) {
        this._ensureIsConstant(constant);
        const clazz = constant.split('.', 2)[0];
        constant = constant.split('.', 2)[1];
        return Class.scope[clazz][constant];
    }

    /**
     * @param {string} constant
     * @param {number} value
     */
    set(constant, value) {
        this._ensureIsConstant(constant);
        if (!this._originalValues.has(constant)) {
            this._originalValues.set(constant, this.get(constant));
        }
        const clazz = constant.split('.', 2)[0];
        constant = constant.split('.', 2)[1];
        Class.scope[clazz][constant] = value;
    }

    /**
     * @param {string} constant
     */
    reset(constant) {
        this._ensureIsConstant(constant);
        if (this._originalValues.has(constant)) {
            this.set(constant, this._originalValues.get(constant));
        }
    }
}

Class.register(ConstantHelper);
