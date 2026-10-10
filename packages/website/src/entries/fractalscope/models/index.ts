export type { PlaneRegion } from './common';
export {
    createEscapeField,
    type EscapeField,
    type EscapeFieldOptions,
    type EscapeGrid,
    INTERIOR,
    UNKNOWN,
} from './escape-field';
export { type EscapeKernel, type EscapeMeasure, pickKernel } from './fractal-kernels';
export { createPlaneViewport, type PlaneViewport, type PlaneViewportOptions } from './plane-viewport';
export { createExplorerModel, type ExplorerModel } from './explorer-model';
export {
    BASE_ITERATIONS,
    COARSEST_BLOCK,
    ITERATIONS_PER_FRAME,
    ITERATIONS_PER_HALVING,
    MAX_ITERATIONS,
    OVERVIEW_COLS,
    OVERVIEW_ROWS,
    SETTLE_MS,
} from './model-constants';
