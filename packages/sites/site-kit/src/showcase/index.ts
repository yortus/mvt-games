// What a site's showcase is built from (see `SiteConfig.showcase`). It
// imports PixiJS 3D, so only a showcase's own code, which loads as it's
// chosen, imports this. The guide to building one is this folder's README.
export { type AttractPilot, type AttractPilotOptions, createAttractPilot } from './attract-pilot';
export { computeQuadTransform, type QuadTransformOptions } from './compute-quad-transform';
export { fitShowcaseWidth, type FitShowcaseWidthOptions } from './fit-showcase-width';
export { frameScreen, type FrameScreenOptions, type ScreenFraming } from './frame-screen';
export { LiveElementView, type LiveElementViewBindings } from './live-element-view';
export { createLiveEntriesHost, type LiveEntriesHost, type LiveEntriesHostOptions, type LiveEntry } from './live-entries-host';
export { LiveScreenView, type LiveScreenViewBindings } from './live-screen-view';
export { LookDragView, type LookDragViewBindings } from './look-drag-view';
export { placeScreen, type PlaceScreenOptions, type ScreenPlacement } from './place-screen';
export { ShowcaseHudView, type ShowcaseHudViewBindings } from './showcase-hud-view';
export { WalkerCameraView, type WalkerCameraViewBindings } from './walker-camera-view';
export { createWalkerModel, type Stand, type Strafing, type Walking, type WalkerModel, type WalkerModelOptions } from './walker-model';
