import { inject } from 'vitest';
import type { CanvasImage } from './canvas-drawing';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A kind of view drawn on a canvas, such as Pixi's or three.js's. It says
 * how vsnap knows the view, prepares it, draws it and disposes of it. `V`
 * is the view's type, `O` is the type of its tests' options, and `N` is
 * the kind's name, which tests give as their `kind`.
 */
export interface CanvasViewKind<V = unknown, O = object, N extends string = string> {
    /** The kind's name, such as `'pixi'`, which a test gives as its `kind`. */
    readonly kind: N;
    /** Returns whether a value that a pose returned is a view of this kind. */
    readonly isView: (value: unknown) => boolean;
    /**
     * Options for every test of this kind, which a test's own options
     * override, such as a project's background. vsnap gives each test its
     * options with these under them.
     */
    readonly defaults?: DefaultsOf<O>;
    /** Runs before the pose of each test of this kind, with the test's options, such as to set the defaults that textures are made with. */
    readonly beforePose?: (options: O) => void;
    /** Prepares a view after its pose returns it, and before its image is taken. */
    readonly prepare?: (view: V) => void;
    /**
     * Draws the prepared view within the size budget, and returns its image,
     * or the canvas that it drew on, which vsnap reads. `fitImage` says how
     * an image fits the budget, and `readCanvas` reads a canvas.
     */
    readonly draw: (view: V, options: O & { readonly maxPixels: number }) => DrawnImage | Promise<DrawnImage>;
    /** Disposes of the view after its image is taken. A kind without it leaves the view as it is. */
    readonly dispose?: (view: V) => void;
    /** Something to check, said to a test whose image is blank, such as whether a camera looks at the view. */
    readonly blankHint?: string;
}

/**
 * The type of a kind's defaults: some of its options. `ViewKind`, which any
 * kind fits, has options of type `never`, and its defaults may then be any
 * object.
 */
export type DefaultsOf<O> = [O] extends [never] ? object : Partial<O>;

/** What a kind of view's `draw` returns: an image, or the canvas that it drew on. */
export type DrawnImage = CanvasImage | HTMLCanvasElement | OffscreenCanvas;

/** How vsnap prepares an HTML view before its image is taken, and disposes of it after. */
export interface HtmlViewKind {
    readonly kind: 'html';
    readonly prepare?: (view: Element) => void;
    readonly dispose?: (view: Element) => void;
    /** The background of every HTML test whose options don't set one. */
    readonly background?: number | string;
}

/** Any kind of view that a project can list. */
export type ViewKind = CanvasViewKind<never, never, string> | HtmlViewKind;

/** A project's `vsnap.config.ts`, which runs in the test page. */
export interface VsnapConfig<Views extends readonly ViewKind[] = readonly ViewKind[], D extends string = string> {
    /** The kinds of view that the project's tests pose. */
    readonly views: Views;
    /**
     * The kind of canvas view that a canvas test poses when it gives no
     * `kind`. The default is `'canvas'`: a canvas that the pose drew.
     */
    readonly defaultKind?: D;
}

/**
 * What a project's `vsnap.config.ts` tells vsnap's types. The project adds
 * its config's type here, so that `canvasTest` knows its kinds of view and
 * its default kind:
 *
 * ```ts
 * declare module 'vsnap' {
 *     interface Register {
 *         config: typeof config;
 *     }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- a project adds its config by declaration merging
export interface Register {}

/**
 * The canvas kinds of view that a config lists, by name, and the built-in
 * `'canvas'`, each with its view and options. By default, the config is the
 * one that the project registered.
 */
export type CanvasKinds<C extends VsnapConfig = RegisteredConfig> = CanvasKindsOf<C['views']> & {
    readonly canvas: { readonly view: HTMLCanvasElement | OffscreenCanvas; readonly options: Record<never, never> };
};

/** The kind that a canvas test poses when it gives no `kind`. By default, the config is the one that the project registered. */
export type DefaultKind<C extends VsnapConfig = RegisteredConfig> = DefaultOf<C> & keyof CanvasKinds<C>;

/**
 * The options of a canvas test of one kind. `kind` may be left out for the
 * default kind. By default, the config is the one that the project
 * registered; a project that uses `bindCanvasTest` names its own, as in
 * `CanvasTestOptions<'three', typeof config>`.
 */
export type CanvasTestOptions<K extends keyof CanvasKinds<C> = DefaultKind, C extends VsnapConfig = RegisteredConfig> = KindOptions<C, K>;

/** The options of a canvas test of one kind of a config. */
export type KindOptions<C extends VsnapConfig, K extends keyof CanvasKinds<C>> = { readonly kind?: K } & OptionsOf<C, K>;

/** The view of one kind of a config. */
export type ViewOf<C extends VsnapConfig, K extends keyof CanvasKinds<C>> = CanvasKinds<C>[K] extends { readonly view: infer V } ? V : never;

/** The options of one kind of a config, without `kind`. */
export type OptionsOf<C extends VsnapConfig, K extends keyof CanvasKinds<C>> = CanvasKinds<C>[K] extends { readonly options: infer O } ? O : never;

/** The config that the project registered, or one with no kinds of view. */
export type RegisteredConfig = Register extends { readonly config: infer C extends VsnapConfig } ? C : VsnapConfig<readonly [], never>;

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns a project's `vsnap.config.ts` settings as they are. It keeps each
 * kind's name, so that the project can register the config's type for
 * `canvasTest`.
 */
export function defineVsnapConfig<const Views extends readonly ViewKind[], const D extends CanvasNamesOf<Views> = never>(
    config: { readonly views: Views; readonly defaultKind?: D },
): VsnapConfig<Views, D> {
    return config;
}

/**
 * Returns how vsnap treats HTML views. With no options, it removes each
 * element after its image is taken. A project whose views need more
 * prepares and disposes of them its own way. `background` is the background
 * of every HTML test whose options don't set one.
 */
export function htmlViews(options: {
    readonly prepare?: (view: Element) => void;
    readonly dispose?: (view: Element) => void;
    readonly background?: number | string;
} = {}): HtmlViewKind {
    return { kind: 'html', ...options };
}

/**
 * Returns a test's options with a kind's defaults under them: a default
 * applies where the test's options leave the option out, or set it to
 * `undefined`.
 */
export function applyDefaults<O extends object>(defaults: Partial<O> | undefined, options: O): O {
    if (defaults === undefined) return options;
    const merged: Record<string, unknown> = { ...defaults };
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) merged[key] = value;
    }
    return merged as O;
}

/**
 * Returns the kinds of view that the project registered in its
 * `vsnap.config.ts`, which the config found, its default kind, and where the
 * file is. It loads them once for each page. A project with no such file
 * has none. It throws if two kinds have one name, or two say how to treat
 * HTML views, or if the default kind is not one of the kinds.
 */
export async function loadViewKinds(): Promise<ViewKinds> {
    kinds ??= load();
    return kinds;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface ViewKinds {
    readonly canvas: readonly CanvasViewKind<unknown, object>[];
    readonly html: HtmlViewKind;
    /** The kind that a canvas test poses when it gives no `kind`. */
    readonly defaultKind: string;
    /** Where the project's `vsnap.config.ts` is, or would be, for messages. */
    readonly configFile: string;
    readonly hasConfig: boolean;
    /** The config itself, which a `canvasTest` that `bindCanvasTest` made checks it was bound to. */
    readonly config: VsnapConfig;
}

/** The names of the canvas kinds among some kinds of view. */
type CanvasNamesOf<Views extends readonly ViewKind[]> = Exclude<Views[number], HtmlViewKind>['kind'];

/** The canvas kinds among some kinds of view, by name, each with its view and options. */
type CanvasKindsOf<Views extends readonly ViewKind[]> = {
    readonly [K in Exclude<Views[number], HtmlViewKind> as K['kind']]: K extends CanvasViewKind<infer V, infer O, string>
        ? { readonly view: V; readonly options: O }
        : never;
};

/** A config's default kind, or `'canvas'` if it names none. */
type DefaultOf<C> = C extends { readonly defaultKind?: infer D } ? ([Exclude<D, undefined>] extends [never] ? 'canvas' : Exclude<D, undefined>) : 'canvas';

let kinds: Promise<ViewKinds> | undefined;

async function load(): Promise<ViewKinds> {
    const configFile = inject('visualConfigFile');
    // Vite resolves this name to the project's file, as it resolves the
    // project's own imports of it, so a test that imports the file gets this
    // same module.
    // @ts-expect-error -- an alias that vsnap's config sets for each project, which TypeScript can't see
    const config = ((await import('virtual:vsnap-config')) as { readonly default: VsnapConfig }).default;
    const canvas: CanvasViewKind<unknown, object>[] = [];
    let html: HtmlViewKind | undefined;
    for (const view of config.views) {
        // Only a canvas kind draws, so a canvas kind named 'html' is not taken
        // for the HTML kind.
        if (!isCanvasKind(view)) {
            if (html !== undefined) throw new Error(`${configFile} lists htmlViews more than once. List it once.`);
            html = view;
        }
        else {
            if (view.kind === 'canvas' || view.kind === 'html') {
                const what = view.kind === 'canvas' ? 'a canvas that a pose drew' : 'HTML views';
                throw new Error(`${configFile} lists a kind of view named '${view.kind}', which is vsnap's own name for ${what}. Give the kind another name.`);
            }
            if (canvas.some((kind) => kind.kind === view.kind)) throw new Error(`${configFile} lists two kinds of view named '${view.kind}'. List each kind once.`);
            canvas.push(view as CanvasViewKind<unknown, object>);
        }
    }
    const defaultKind = config.defaultKind ?? 'canvas';
    if (defaultKind !== 'canvas' && !canvas.some((kind) => kind.kind === defaultKind)) {
        throw new Error(`${configFile} names '${defaultKind}' as its default kind, but lists no kind of view with that name.`);
    }
    return { canvas, html: html ?? htmlViews(), defaultKind, configFile, hasConfig: inject('visualHasConfig'), config };
}

/** Returns whether a kind of view is a canvas kind: one that draws its views. */
function isCanvasKind(view: ViewKind): view is CanvasViewKind<never, never, string> {
    return 'draw' in view;
}
