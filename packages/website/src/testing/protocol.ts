/**
 * What the page and Node say to each other: the visual tests' browser
 * commands (they run in Node, called from the page), their arguments and
 * their answers. The page's side is `commands.ts`; Node's is
 * `scripts/visual/commands.ts`.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a run does with pictures. `compare` checks them; `update` also
 * writes the reference of every picture that changed or is new;
 * `environment` also rewrites the environment's fingerprint and the
 * calibration set's references.
 */
export type VisualMode = 'compare' | 'update' | 'environment';

/** Which project a page belongs to: WebGL pictures in one shared page, or HTML pictures in a page per file. */
export type VisualKind = 'pixi' | 'html';

/** How a picture compares with its reference. */
export type VisualOutcome =
    | 'same' // identical pixels
    | 'within-tolerance' // no channel differs by more than the tolerance
    | 'differs'
    | 'new' // no reference
    | 'size' // a different size from the reference
    | 'updated'; // written as the new reference

export interface VisualVerdict {
    readonly outcome: VisualOutcome;
    /** Pixels that differ, and the largest difference in a channel (0 to 255). */
    readonly changed?: number;
    readonly maxDelta?: number;
    /** The smallest rectangle holding every pixel that differs. */
    readonly changedRect?: VisualRect;
    /** The reference's size, when it differs. */
    readonly referenceSize?: string;
    /** Where the reference is, and where the actual picture and the diff were written, from the repo's root. */
    readonly referenceFile: string;
    readonly actualFile?: string;
    readonly diffFile?: string;
}

/**
 * Which pictures a request is about: a test file's (the file calling), or
 * a project's calibration set, checked before any test.
 */
export interface VisualScope {
    readonly calibration?: VisualKind;
}

/** A picture: the file name of its reference, and the full name of the test that makes it. */
export interface VisualPictureId extends VisualScope {
    readonly name: string;
    readonly test: string;
}

/** A picture's pixels as sent to Node: RGBA, rows from the top, in base64. */
export interface VisualPicturePayload extends VisualPictureId {
    readonly width: number;
    readonly height: number;
    readonly hash: string;
    readonly pixels: string;
}

/** A rectangle of the top-level page, in CSS pixels, whole. */
export interface VisualRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** An HTML picture to capture, by the rectangle it fills. */
export interface VisualCaptureRequest extends VisualPictureId {
    readonly rect: VisualRect;
}

/** Facts about the browser and page, which must match the reference environment's. */
export interface VisualEnvironment {
    readonly browser: string;
    readonly webglRenderer: string;
    readonly locale: string;
    readonly timeZone: string;
    readonly devicePixelRatio: number;
}

/** What a page is told once per test file (or per calibration set). */
export interface VisualSession {
    readonly mode: VisualMode;
    /** The hash of each reference in scope, by picture name. */
    readonly hashes: Readonly<Record<string, string>>;
    /** For a calibration set: whether this run has already checked it (an HTML page per file asks again). */
    readonly isCalibrated: boolean;
}

/** Timings and outcome, attached to each test for the run's summary. */
export interface VisualTestMeta {
    readonly kind: VisualKind;
    readonly outcome: VisualOutcome;
    readonly width: number;
    readonly height: number;
    /** Picture pixels per view pixel: 1, or less for a big smooth view drawn to fit the budget. */
    readonly resolution: number;
    /** Milliseconds per stage: pose, refresh, draw, hash, capture, compare. */
    readonly ms: Readonly<Record<string, number>>;
}

declare module 'vitest' {
    interface TaskMeta {
        /** A visual test's timings and outcome, for the run's summary. */
        visual?: VisualTestMeta;
    }
    interface ProvidedContext {
        /** Which project the page belongs to, provided by its config. */
        visualKind: VisualKind;
        /** The size budget, in pixels, provided by the config (`maxPixels`). */
        visualMaxPixels: number;
    }
}

/** The commands, as the page calls them (the context argument Node receives is left out). */
export interface VisualCommands {
    visualSession: (scope: VisualScope) => Promise<VisualSession>;
    /** A WebGL picture whose hash is not its reference's: Node compares, writes files, and judges. */
    visualMismatch: (picture: VisualPicturePayload) => Promise<VisualVerdict>;
    /** An HTML picture: Node takes the screenshot of the rectangle, and judges it. */
    visualCapture: (request: VisualCaptureRequest) => Promise<VisualVerdict & { readonly captureMs: number }>;
    /**
     * The browser's facts, checked against the reference environment's (or,
     * in `environment` mode, written as them). Returns what differed.
     */
    visualEnvironment: (environment: VisualEnvironment) => Promise<readonly string[]>;
    /** Records that a calibration set matched, so the run's other pages skip it. */
    visualCalibrated: (kind: VisualKind) => Promise<void>;
    /** Stops the run before any more tests, with one error. */
    visualAbort: (message: string) => Promise<void>;
}
