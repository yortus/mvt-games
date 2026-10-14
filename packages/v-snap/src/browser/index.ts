export { type CanvasImage, readCanvas } from './canvas-drawing';
export type { HtmlImageOptions } from './html-image';
export type { ColorScheme } from '../protocol';
export type { Pose } from './pose';
export { fitImage } from '../shared';
export {
    type CanvasKinds, type CanvasTestOptions, type CanvasViewKind, type DefaultKind, defineVsnapConfig, type DrawnImage, type HtmlViewKind, htmlViews, type Register,
    type ViewKind, type VsnapConfig,
} from './view-kinds';
export {
    bindCanvasTest, type CanvasTestAPI, type CanvasTestDeclarer, type CanvasTestExtras, type CanvasTestForms, canvasTest, type CaseArgs, type CasePose, htmlTest, type HtmlTestAPI,
    type HtmlTestDeclarer, type HtmlTestForms, type WithModifiers,
} from './visual-test';
export type { VitestTestOptions } from './test-options';
