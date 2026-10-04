// Registers three.js objects, through `object3d-mixin`. `sideEffects` lists this
// module as well as the mixin: a bundler skips a module it thinks is pure when
// a program uses only names it re-exports (such as `updateView`, from
// `@mvtjs/utils`), and the mixin would go with it.
export { createPointerPicker } from './pointer-picker';
export type { PointerEventSource, PointerLike, PointerPickEvent } from './pointer-picker';
export type { PointerPickEventKind, PointerPicker, PointerPickerOptions } from './pointer-picker';
export { destroyObject, isDestroyed, onDestroyed } from './object3d-mixin';
export { hasRefresh, hasUpdate, refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/utils';
export { addReads, countTick, tickCounter } from '@mvtjs/utils';
export type { RefreshMethod, TickCounter, TickCounts, UpdateMethod, View } from '@mvtjs/utils';
export * from './jsx';
