// `pixi-stage.ts` is not exported: the host imports it when it first needs Pixi.
export { createEntryHost, type EntryHost, type EntryHostOptions, type PlayTarget, type Rect } from './entry-host';
export { isTouchDevice } from './is-touch-device';
export { fitPlayArea, type PlayArea, type PlayAreaOptions } from './play-area';
