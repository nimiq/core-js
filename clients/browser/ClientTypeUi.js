class ClientTypeUi {
    constructor(el, $) {
        this.$el = el;
        this.$ = $;

        this.$title = el.querySelector('[title]');

        $.consensus.on('syncing', () => this.$title.classList.add('syncing'));
        $.consensus.on('sync-chain-proof', () => this.$title.classList.add('sync-chain-proof'));
        $.consensus.on('verify-chain-proof', () => this.$title.classList.add('verify-chain-proof'));
        $.consensus.on('sync-accounts-tree', () => this.$title.classList.add('sync-accounts-tree'));
        $.consensus.on('verify-accounts-tree', () => this.$title.classList.add('verify-accounts-tree'));
        $.consensus.on('established', () => this.$title.classList.add('consensus-established'));
        $.consensus.on('lost', () => this.$title.classList.remove('initializing', 'connecting', 'syncing',
            'sync-chain-proof', 'verify-chain-proof', 'sync-accounts-tree', 'verify-accounts-tree',
            'consensus-established'));

        this.$title.classList.add('connecting');
    }
}
