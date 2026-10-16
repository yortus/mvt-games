// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The view types of the renderers installed in a program, keyed by renderer.
 * Empty here: each renderer package adds its own, with a module augmentation
 * in the module that registers the renderer (`registerRenderer`):
 *
 * ```ts
 * declare module '@mvtjs/utils' {
 *     interface RendererViews { pixi: Container }
 * }
 * ```
 *
 * An augmentation applies to the whole program once the file declaring it is
 * part of it, so every entry point of a renderer package imports that module,
 * at least for its side effect, and its declaration file carries it.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by renderer packages' augmentations
export interface RendererViews {}

/**
 * A view of any renderer installed in the program: what `updateView`,
 * `refreshView`, `setUpdate`, `setRefresh`, `hasUpdate` and `hasRefresh`
 * accept. Where no renderer is installed it is a type no value has, named so
 * that the error says what is missing.
 */
export type View = [keyof RendererViews] extends [never]
    ? { readonly 'No renderer is installed: import a renderer package, such as @mvtjs/pixi': never }
    : RendererViews[keyof RendererViews];
