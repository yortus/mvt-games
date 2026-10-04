// Registers Pixi containers, and declares their view type for every importer.
// `sideEffects` lists this module as well as the mixin: a bundler skips a
// module it thinks is pure when a program uses only names it re-exports (such
// as `updateView`, from `@mvtjs/utils`), and this import would go with it.
import './container-mixin';
export { createPerformanceMetrics, type MetricKind, type PerformanceMetrics } from './performance-metrics';
export type { PerformanceMetricsOptions } from './performance-metrics';
export { createTextureRegistry, type TextureRegistry } from './texture-registry';
export { hasRefresh, hasUpdate, refreshView, setRefresh, setUpdate, SKIP_DESCENDANTS, updateView } from '@mvtjs/utils';
export { addReads, countTick, tickCounter } from '@mvtjs/utils';
export type { RefreshMethod, TickCounter, TickCounts, UpdateMethod, View } from '@mvtjs/utils';
export * from './jsx';
