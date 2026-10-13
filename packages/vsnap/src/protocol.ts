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
 * What a run does with the actual images.
 *
 * - `compare` checks them against their references.
 * - `update` also writes each actual image that changed or is new as its
 *   reference.
 * - `environment` also rewrites the environment's fingerprint (the browser's
 *   facts in `visual-environment.json`) and the calibration set's references.
 */
export type VisualMode = 'compare' | 'new' | 'update' | 'environment';

/**
 * The kind of page that a visual test runs in, and so its project. Canvas
 * tests draw their views to images in one page that they share. HTML tests
 * capture their views in a page for each file.
 */
export type PageKind = 'canvas' | 'html';

/** How an actual image compares with its reference. */
export type VisualOutcome =
    | 'same' // identical pixels
    | 'within-tolerance' // no channel differs by more than the tolerance
    | 'differs'
    | 'new' // no reference
    | 'size' // a different size from the reference
    | 'updated' // written as the new reference
    | 'added'; // written as the reference of a new image

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
     * The reference's path, and the paths that the actual image and the
     * diff were written to. Each path is relative to the repo's root.
     */
    readonly referenceFile: string;
    readonly actualFile?: string;
    readonly diffFile?: string;
    /** The test file, relative to the repo's root, for the command that a failure message suggests. */
    readonly testFile?: string;
    /**
     * The images of a failed comparison, by absolute path, with their sizes:
     * the reference image if there is one, the actual image, and the diff if
     * they are the same size. The test records them for Vitest's UI and
     * reports.
     */
    readonly images?: readonly VisualVerdictImage[];
}

/** One image of a failed comparison. */
export interface VisualVerdictImage {
    readonly name: 'reference' | 'actual' | 'diff';
    readonly path: string;
    readonly width: number;
    readonly height: number;
}

/**
 * Which images a request is about. Without `calibration`, they are the
 * images of the test file that calls. With it, they are that project's
 * calibration set, which is checked before any test.
 */
export interface VisualScope {
    readonly calibration?: PageKind;
}

/** Identifies an image by the file name of its reference and the full name of the test that produces it. */
export interface VisualImageId extends VisualScope {
    readonly name: string;
    readonly test: string;
}

/**
 * An actual image's pixels as sent to Node. They are RGBA, with rows from the top,
 * encoded in base64.
 */
export interface VisualImagePayload extends VisualImageId {
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

/** A request to capture the actual image of an HTML view. It gives the rectangle to capture. */
export interface VisualCaptureRequest extends VisualImageId {
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
    /** The hash of each reference in scope, by image name. */
    readonly hashes: Readonly<Record<string, string>>;
    /**
     * For a calibration set, whether this run has already checked it. Each
     * HTML test file has a page of its own, and each of those pages asks again.
     */
    readonly isCalibrated: boolean;
}

/** A calibration set that matched. It gives the set's kind of page and the names of the calibration images compared. */
export interface VisualCalibration {
    readonly pageKind: PageKind;
    readonly names: readonly string[];
}

/** A visual test's timings and outcome. They are attached to each test for the run's summary. */
export interface VisualTestMeta {
    readonly pageKind: PageKind;
    readonly outcome: VisualOutcome;
    readonly width: number;
    readonly height: number;
    /** Image pixels per view pixel. This is 1, or less for a big smooth view drawn to fit the budget. */
    readonly resolution: number;
    /** Milliseconds spent in each stage. The stages are pose, refresh, draw, hash, capture and compare. */
    readonly ms: Readonly<Record<string, number>>;
}

/**
 * What vsnap records on each visual test, for its reporter. It is the test's
 * one entry in Vitest's task meta, which the page hands to Node with the
 * test, and which the Vitest UI shows as the test's meta.
 */
export interface VsnapTestRecord {
    /**
     * The test's image name. It is set as the test starts, so a test that
     * fails before its actual image is produced still counts as using its
     * reference.
     */
    readonly image: string;
    /** The test's outcome, size and timings, once its image is judged. */
    readonly result?: VisualTestMeta;
}

declare module 'vitest' {
    interface TaskMeta {
        /** What vsnap records on a visual test, for the run's checks and summary. */
        vsnap?: VsnapTestRecord;
    }
    interface ProvidedContext {
        /** The kind of page, provided by its project's config. */
        visualPageKind: PageKind;
        /** The size budget in pixels, provided by the config (`maxPixels`). */
        visualMaxPixels: number;
        /** Whether the project has a `vsnap.config`, which registers its kinds of view. */
        visualHasConfig: boolean;
        /** The path of the project's `vsnap.config`, or where vsnap looked for it, for messages. */
        visualConfigFile: string;
    }
}

/** The commands as the page calls them. The context argument that Node receives is left out. */
export interface VisualCommands {
    openVisualSession: (scope: VisualScope) => Promise<VisualSession>;
    /**
     * Sends Node an actual image, rendered with WebGL, whose hash is not its
     * reference's. Node compares the two images, writes the files, and returns
     * the verdict.
     */
    judgeVisualMismatch: (image: VisualImagePayload) => Promise<VisualVerdict>;
    /**
     * Asks Node to take a screenshot of an HTML view's rectangle. Node
     * judges the actual image and returns the verdict.
     */
    captureVisualImage: (request: VisualCaptureRequest) => Promise<VisualVerdict & { readonly captureMs: number }>;
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
