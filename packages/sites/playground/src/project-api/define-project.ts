import type { Container } from 'pixi.js';
import type { PerspectiveCamera, Scene } from 'three';
import type { Audio80 } from 'audio90';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a project's `start` returns: anything with an `update`, usually the
 * model. Each frame, the playground calls `update`, then updates and
 * refreshes the views, then draws.
 */
export interface Ticked {
    readonly update: (deltaMs: number) => void;
}

/** What `start` returns: something to tick, or nothing, for a project with no model. */
export type StartResult = Ticked | void;

/** What every project's `start` is given. */
export interface StartOptions {
    /**
     * The Audio80, the sound chip the project's audio views play on. It is
     * made the first time it is read, so a project that never reads it makes
     * no sound.
     */
    readonly sound: Audio80;
    /** The width of the play area, in the project's own pixels. */
    readonly width: number;
    /** The height of the play area, in the project's own pixels. */
    readonly height: number;
}

/** What a Pixi project's `start` is given. */
export interface PixiStartOptions extends StartOptions {
    /** The container the project adds its views to. */
    readonly stage: Container;
}

/** What an HTML project's `start` is given. */
export interface HtmlStartOptions extends StartOptions {
    /** The element the project adds its views to. It fills the preview. */
    readonly root: HTMLElement;
}

/** What a three.js project's `start` is given. */
export interface ThreeStartOptions extends StartOptions {
    /** The scene the project adds its views to. */
    readonly scene: Scene;
    /** The camera the scene is drawn with, 5 units back from the origin. The project may move it. */
    readonly camera: PerspectiveCamera;
}

/** How a Pixi project is laid out and started. */
export interface PixiProjectOptions {
    /** The play area's width, in the project's own pixels. The preview scales it to fit. */
    readonly width: number;
    /** The play area's height, in the project's own pixels. */
    readonly height: number;
    /** The colour behind the stage, such as `0x1a1a2e`. */
    readonly background?: number;
    /** Whether to draw as pixel art: no smoothing, and positions rounded to whole pixels. */
    readonly pixelArt?: boolean;
    /** Builds the project's models and views, and returns what to tick. It may return a promise. */
    readonly start: (options: PixiStartOptions) => StartResult | Promise<StartResult>;
}

/** How an HTML project is laid out and started. */
export interface HtmlProjectOptions {
    /** The root's width, in CSS pixels. Without it, the root fills the preview's width. */
    readonly width?: number;
    /** The root's height, in CSS pixels. Without it, the root fills the preview's height. */
    readonly height?: number;
    /** The colour behind the root's elements, such as `0x1a1a2e`. Their text is light, so the default is near black. */
    readonly background?: number;
    /** Builds the project's models and views, and returns what to tick. It may return a promise. */
    readonly start: (options: HtmlStartOptions) => StartResult | Promise<StartResult>;
}

/** How a three.js project is laid out and started. */
export interface ThreeProjectOptions {
    /** The drawing's width, in pixels. The preview scales it to fit. */
    readonly width: number;
    /** The drawing's height, in pixels. */
    readonly height: number;
    /** The colour behind the scene, such as `0x1a1a2e`. */
    readonly background?: number;
    /** Builds the project's models and views, and returns what to tick. It may return a promise. */
    readonly start: (options: ThreeStartOptions) => StartResult | Promise<StartResult>;
}

/** A project drawn with Pixi, as `definePixiProject` returns it. */
export interface PixiProject extends PixiProjectOptions {
    readonly renderer: 'pixi';
}

/** A project built from HTML elements, as `defineHtmlProject` returns it. */
export interface HtmlProject extends HtmlProjectOptions {
    readonly renderer: 'html';
}

/** A project drawn with three.js, as `defineThreeProject` returns it. */
export interface ThreeProject extends ThreeProjectOptions {
    readonly renderer: 'three';
}

/** A project of any kind. Its `main.ts` exports it as `project`. */
export type Project = PixiProject | HtmlProject | ThreeProject;

/** The renderers a project can use. */
export type RendererKind = Project['renderer'];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Returns a project drawn with Pixi. Its `start` is given a stage to add views to. */
export function definePixiProject(options: PixiProjectOptions): PixiProject {
    return { ...options, renderer: 'pixi' };
}

/** Returns a project built from HTML elements. Its `start` is given a root element to add views to. */
export function defineHtmlProject(options: HtmlProjectOptions): HtmlProject {
    return { ...options, renderer: 'html' };
}

/** Returns a project drawn with three.js. Its `start` is given a scene and a camera. */
export function defineThreeProject(options: ThreeProjectOptions): ThreeProject {
    return { ...options, renderer: 'three' };
}
