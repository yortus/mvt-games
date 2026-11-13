// Input that needs no renderer. It holds the keyboard, and the arcade
// controls that the entry host creates for a game. It also handles taps and
// drags over a grid, in cells, taps and holds on a row of keys, and pans
// and zooms over an element. It follows one pointer over a DOM element,
// since the DOM is no renderer here.
// Input on a Pixi stage is in ./pixi/.

export { ARCADE_CONTROL_KEYS, type ArcadeControlKeys } from './arcade-control-keys';
export {
    type ArcadeControl, type ArcadeControls, type ArcadeControlsListener, type ArcadeControlsOptions, type ArcadeControlSource,
    createArcadeControls,
} from './arcade-controls';
export { describeControl } from './describe-control';
export { describeKey } from './describe-key';
export {
    createGridGesturesViewModel, type GridGesturesViewModel, type GridGesturesViewModelOptions, type GridLattice, type GridSteps,
} from './grid-gestures-view-model';
export { type ElementPointerOptions, listenToElementPointer } from './listen-to-element-pointer';
export { type KeysOptions, listenToKeys } from './listen-to-keys';
export { listenToPanZoom, type PanZoomOptions } from './listen-to-pan-zoom';
export {
    createPressGesturesViewModel, type PressGesturesViewModel, type PressGesturesViewModelOptions,
} from './press-gestures-view-model';
