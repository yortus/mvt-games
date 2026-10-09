/**
 * These are the messages between the test page and Node. They are the
 * visual tests' browser commands, with their arguments and their answers.
 * The commands run in Node, and the page calls them. The page's side is in
 * `src/browser/judge.ts`, and Node's side is in `src/node/commands.ts`.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a run does with pictures.
 *
 * - `compare` checks them against their references.
 * - `update` also writes the reference of every picture that changed or is
 *   new.
 * - `environment` also rewrites the environment's fingerprint (the browser's
 *   facts in `visual-environment.json`) and the calibration set's references.
 */
export type VisualMode = 'compare' | 'update' | 'environment';

/**
 * Which project a page belongs to. The `pixi` project draws WebGL pictures
 * in one shared page. The `html` project captures HTML pictures, in a page
 * for each file.
 */
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
    /** The number of pixels that differ, and the largest difference in any channel (0 to 255). */
    readonly changed?: number;
    readonly maxDelta?: number;
    /** The smallest rectangle holding every pixel that differs. */
    readonly changedRect?: VisualRect;
    /** The reference's size, when it differs. */
    readonly referenceSize?: string;
    /**
     * The reference's path, and the paths that the actual picture and the
     * diff were written to. Each path is relative to the repo's root.
     */
    readonly referenceFile: string;
    readonly actualFile?: string;
    readonly diffFile?: string;
}

/**
 * Which pictures a request is about. Without `calibration`, they are the
 * pictures of the test file that calls. With it, they are that project's
 * calibration set, which is checked before any test.
 */
export interface VisualScope {
    readonly calibration?: VisualKind;
}

/** Identifies a picture by the file name of its reference and the full name of the test that makes it. */
export interface VisualPictureId extends VisualScope {
    readonly name: string;
    readonly test: string;
}

/**
 * A picture's pixels as sent to Node. They are RGBA, with rows from the top,
 * encoded in base64.
 */
export interface VisualPicturePayload extends VisualPictureId {
    readonly width: number;
    readonly height: number;
    readonly hash: string;
    readonly pixels: string;
}

/** A rectangle of the top-level page, in whole CSS pixels. */
export interface VisualRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** A request to capture an HTML picture, which gives the rectangle the picture fills. */
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

/** What Node tells a page once for each test file, or for each calibration set. */
export interface VisualSession {
    readonly mode: VisualMode;
    /** The hash of each reference in scope, by picture name. */
    readonly hashes: Readonly<Record<string, string>>;
    /**
     * For a calibration set, whether this run has already checked it. Each
     * HTML test file has a page of its own, and each of those pages asks again.
     */
    readonly isCalibrated: boolean;
}

/** A calibration set that matched. It gives the set's kind and the names of the pictures compared. */
export interface VisualCalibration {
    readonly kind: VisualKind;
    readonly names: readonly string[];
}

/** A visual test's timings and outcome. They are attached to each test for the run's summary. */
export interface VisualTestMeta {
    readonly kind: VisualKind;
    readonly outcome: VisualOutcome;
    readonly width: number;
    readonly height: number;
    /** Picture pixels per view pixel. This is 1, or less for a big smooth view drawn to fit the budget. */
    readonly resolution: number;
    /** Milliseconds spent in each stage. The stages are pose, refresh, draw, hash, capture and compare. */
    readonly ms: Readonly<Record<string, number>>;
}

declare module 'vitest' {
    interface TaskMeta {
        /** A visual test's timings and outcome, for the run's summary. */
        visual?: VisualTestMeta;
        /**
         * The name of a visual test's reference file. It is set as the test
         * starts, so a test that fails before its picture is drawn still
         * counts as using the reference.
         */
        visualPicture?: string;
    }
    interface ProvidedContext {
        /** Which project the page belongs to, provided by its config. */
        visualKind: VisualKind;
        /** The size budget in pixels, provided by the config (`maxPixels`). */
        visualMaxPixels: number;
    }
}

/** The commands as the page calls them. The context argument that Node receives is left out. */
export interface VisualCommands {
    openVisualSession: (scope: VisualScope) => Promise<VisualSession>;
    /**
     * Sends Node a WebGL picture whose hash is not its reference's. Node
     * compares the pictures, writes the files, and returns the verdict.
     */
    judgeVisualMismatch: (picture: VisualPicturePayload) => Promise<VisualVerdict>;
    /**
     * Asks Node to take a screenshot of an HTML picture's rectangle. Node
     * judges the picture and returns the verdict.
     */
    captureVisualPicture: (request: VisualCaptureRequest) => Promise<VisualVerdict & { readonly captureMs: number }>;
    /**
     * Checks the browser's facts against the reference environment's. In
     * `environment` mode, it writes them as the reference environment's
     * instead. Returns what differed.
     */
    checkVisualEnvironment: (environment: VisualEnvironment) => Promise<readonly string[]>;
    /** Records that a calibration set matched, and which references it used. The run's other pages then skip the set. */
    recordVisualCalibration: (calibration: VisualCalibration) => Promise<void>;
    /** Stops the run before any more tests, with one error. */
    abortVisualRun: (message: string) => Promise<void>;
}
