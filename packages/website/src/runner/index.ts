// `pixi-stage.ts` is not exported. The host imports it the first time it needs Pixi.
export { createEntryHost, type EntryHost, type EntryHostOptions, type PlayTarget, type Rect } from './entry-host';
export { createPageSound, type PageSound, type PageSoundOptions, type SoundSettings } from './page-sound';
export { isTouchDevice } from '../device';
export { fitPlayArea, type PlayArea, type PlayAreaOptions } from './play-area';
