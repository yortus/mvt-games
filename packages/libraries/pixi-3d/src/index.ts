// Registers PixiJS 3D's scene nodes, and declares their view type for every
// importer. `sideEffects` lists this module as well as the mixin: a bundler
// skips a module it thinks is pure when a program uses only names it
// re-exports (such as `updateView`, from `@mvtjs/utils`), and this import
// would go with it.
import './container3d-mixin';

// The view tick API is re-exported here, so a 3D view file imports
// `setUpdate` from the package it draws with, as a 2D one imports it from
// @mvtjs/pixi. They're the same functions.
export { connectScene } from './connect-scene';
export { ScreenAnchorView, type ScreenAnchorViewBindings } from './screen-anchor-view';
export { ScreenView, type ScreenViewBindings } from './screen-view';
export { destroyAndFindLeaks, type DestroyAndFindLeaksOptions, type ResourceLeak } from './destroy-and-find-leaks';
export * from './jsx';
export { ParticlesView, type ParticlesOptions, type ParticlesViewBindings } from './particles-view';
export { Scene3DView, type Scene3DViewBindings } from './scene-3d-view';
export { hasRefresh, hasUpdate, refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/utils';
export { advanceTime, type Advanceable } from '@mvtjs/utils';
export { addReads, countTick, tickCounter } from '@mvtjs/utils';
export type { RefreshMethod, TickCounter, TickCounts, UpdateMethod, View } from '@mvtjs/utils';
