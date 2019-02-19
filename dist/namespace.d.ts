import _Nimiq from './types';

export as namespace Nimiq;
export = _Nimiq;

declare global {
    const Nimiq: typeof _Nimiq;
}
