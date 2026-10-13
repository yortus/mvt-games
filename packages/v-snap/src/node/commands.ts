/**
 * The visual tests' browser commands. A browser command runs in Node, and
 * the test page calls it (the page's side is in `src/browser/judge.ts`).
 * These commands read and write reference images. They compare an actual
 * image whose hash does not match its reference's hash. They capture HTML
 * views through the Chrome DevTools protocol, and they check the
 * environment.
 *
 * Where a test file's references live is set by the project's layout
 * (`src/node/layout.ts`). By default, they are beside it, in
 * `<test file's stem>.<image name>.png`. The calibration set is a set of
 * small images that checks this machine draws like the reference
 * environment. Its references live in this package, in
 * `src/browser/calibration-images/<kind of page>/`. When an actual image
 * fails, its pixels and its diff are written to `.vitest/vsnap/` at the
 * repository's root, in the same directory layout as the repository.
 *
 * The run's mode follows Vitest's rule for snapshots: `new` by default,
 * which writes the reference of a new image, `compare` in CI, which writes
 * none, and `update` with `-u`, which rewrites each changed one. This package's own maintainers set
 * `VSNAP_MODE=environment` to rewrite the environment's fingerprint and the
 * calibration set (`npm run test:visual:environment -w v-snap`).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';
import type {
    VisualCalibration, VisualCaptureRequest, VisualEnvironment, PageKind, VisualMode, VisualImageId, VisualImagePayload, VisualScope,
    VisualSession, VisualVerdict,
} from '../protocol.ts';
import { compareImages, DRAWS_EXACTLY } from './compare.ts';
import { CHECK_CACHE_FILE, ENVIRONMENT_FILE, findCalibrationDir, toDisplayPath, toOutputBase } from './paths.ts';
import { matchReferenceName, type ReferencePattern, resolveReferencePath, resolveReferencePattern, type VisualLayout } from './layout.ts';
import { decodePng, encodePng, hashImage, isLfsPointer, type RgbaImage, readPngHash } from './png.ts';
import { checkReferences } from './references.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What one visual config's commands learn during a run, which its reporter
 * reads at the end: the calibration sets that matched, and the calibration
 * references that actual images were compared with. The actual calibration
 * images are produced while a page is set up, not by tests, so the reporter
 * learns of them here.
 */
export interface VisualRunState {
    readonly calibrated: Set<PageKind>;
    readonly calibrationReferences: Set<string>;
    /** Each page's DevTools protocol session, by the page's session. The reporter clears it as each run starts, since each run has pages of its own. */
    readonly cdpSessions: Map<string, Promise<Cdp>>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a run's state, which a config's commands and reporter share. */
export function createRunState(): VisualRunState {
    return { calibrated: new Set(), calibrationReferences: new Set(), cdpSessions: new Map() };
}

/** Creates the browser commands for a project with this layout. */
export function createVisualCommands(options: { readonly layout: VisualLayout; readonly state: VisualRunState }) {
    const { layout, state } = options;

    const openVisualSession: BrowserCommand<[VisualScope]> = (ctx, scope): VisualSession => {
        const pattern = resolvePattern(ctx, scope);
        const mode = findMode(ctx);
        const hashes: Record<string, string> = {};
        const files = new Map<string, string>();
        if (existsSync(pattern.dir)) {
            for (const file of readdirSync(pattern.dir)) {
                const name = matchReferenceName(pattern, file);
                if (name === undefined) continue;
                const hash = readPngHash(join(pattern.dir, file));
                if (hash !== undefined) hashes[name] = hash;
                files.set(join(pattern.dir, file), name);
            }
        }
        // A run that rewrites references trusts no hash that its pixels don't
        // match, so that each such reference is judged, and rewritten.
        if (isRewriting(mode)) {
            for (const [file, problem] of checkReferences([...files.keys()], CHECK_CACHE_FILE)) {
                if (problem !== undefined) delete hashes[files.get(file) ?? ''];
            }
        }
        return { mode, hashes, isCalibrated: scope.calibration !== undefined && state.calibrated.has(scope.calibration) };
    };

    const recordVisualCalibration: BrowserCommand<[VisualCalibration]> = (_ctx, calibration) => {
        state.calibrated.add(calibration.pageKind);
        for (const name of calibration.names) state.calibrationReferences.add(join(findCalibrationDir(calibration.pageKind), `${name}.png`));
    };

    const judgeVisualMismatch: BrowserCommand<[VisualImagePayload]> = (ctx, payload): VisualVerdict => {
        const pixels = new Uint8Array(Buffer.from(payload.pixels, 'base64'));
        const actual = { width: payload.width, height: payload.height, pixels };
        return judge({ file: resolveFile(ctx, payload), id: payload, actual, mode: findMode(ctx), testFile: ctx.testPath });
    };

    const captureVisualImage: BrowserCommand<[VisualCaptureRequest]> = async (ctx, request) => {
        const started = performance.now();
        const cdp = await connectCdp(ctx, state.cdpSessions);
        const { data } = await cdp.send('Page.captureScreenshot', {
            format: 'png',
            clip: { ...request.rect, scale: 1 },
            optimizeForSpeed: true,
            captureBeyondViewport: false,
        });
        const actual = decodePng(Buffer.from(data, 'base64'));
        const captureMs = performance.now() - started;
        return { ...judge({ file: resolveFile(ctx, request), id: request, actual, mode: findMode(ctx), testFile: ctx.testPath }), captureMs };
    };

    /** Returns the folder and file-name pattern of the references in scope. */
    function resolvePattern(ctx: BrowserCommandContext, scope: VisualScope): ReferencePattern {
        if (scope.calibration !== undefined) return { dir: findCalibrationDir(scope.calibration), prefix: '', suffix: '.png' };
        return resolveReferencePattern(layout, findTestPath(ctx));
    }

    /** Returns the path of an image's reference. */
    function resolveFile(ctx: BrowserCommandContext, id: VisualImageId): string {
        if (id.calibration !== undefined) return join(findCalibrationDir(id.calibration), `${id.name}.png`);
        return resolveReferencePath(layout, findTestPath(ctx), id.name);
    }

    return { openVisualSession, judgeVisualMismatch, captureVisualImage, checkVisualEnvironment, recordVisualCalibration, abortVisualRun };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Returns the run's mode, from Vitest's update flag and the environment variable. */
function findMode(ctx: { readonly project: { readonly vitest: { readonly config: { readonly snapshotOptions: { readonly updateSnapshot: string } } } } }): VisualMode {
    if (process.env.VSNAP_MODE === 'environment') return 'environment';
    // Reference images follow Vitest's rule for snapshots. A new one is
    // written by default, but not in CI, and -u rewrites every changed one.
    const update = ctx.project.vitest.config.snapshotOptions.updateSnapshot;
    return update === 'all' ? 'update' : update === 'new' ? 'new' : 'compare';
}

/** Returns whether a mode rewrites references that changed. */
function isRewriting(mode: VisualMode): boolean {
    return mode === 'update' || mode === 'environment';
}

const checkVisualEnvironment: BrowserCommand<[VisualEnvironment]> = (_ctx, environment): readonly string[] => {
    const facts: EnvironmentFile = {
        browser: environment.browser,
        webgl: environment.webglRenderer.includes('SwiftShader') ? 'SwiftShader' : environment.webglRenderer,
        locale: environment.locale,
        timeZone: environment.timeZone,
        devicePixelRatio: environment.devicePixelRatio,
    };
    if (process.env.VSNAP_MODE === 'environment') {
        writeFileSync(ENVIRONMENT_FILE, JSON.stringify(facts, undefined, 4) + '\n');
        return [];
    }
    if (!existsSync(ENVIRONMENT_FILE)) return [`v-snap's ${toDisplayPath(ENVIRONMENT_FILE)} is missing, so v-snap's package is incomplete. Install it again`];
    const expected = JSON.parse(readFileSync(ENVIRONMENT_FILE, 'utf8')) as EnvironmentFile;
    const problems: string[] = [];
    for (const key of Object.keys(expected) as (keyof EnvironmentFile)[]) {
        if (expected[key] !== facts[key]) problems.push(`${key} is ${JSON.stringify(facts[key])}, but the reference environment's is ${JSON.stringify(expected[key])}`);
    }
    return problems;
};

const abortVisualRun: BrowserCommand<[string]> = (ctx, message) => {
    console.error(`\n${message}\n`);
    // This is not awaited. The cancellation waits for the running file to
    // finish, and the running file is waiting for this command.
    void ctx.project.vitest.cancelCurrentRun('test-failure');
};

interface EnvironmentFile {
    readonly browser: string;
    readonly webgl: string;
    readonly locale: string;
    readonly timeZone: string;
    readonly devicePixelRatio: number;
}

function findTestPath(ctx: BrowserCommandContext): string {
    if (ctx.testPath === undefined) throw new Error('A visual test command was called from outside a test file.');
    return ctx.testPath;
}

/**
 * Compares an actual image with its reference, or writes it as the
 * reference. When the actual image is within the tolerance, `-u` rewrites
 * the reference only on a processor that draws exactly (see
 * `src/node/compare.ts`). That way, an arm64 machine, which rounds a little
 * differently, does not keep rewriting the references.
 *
 * A reference whose name differs from the test's image name only in case,
 * after a test was renamed so, is renamed by `-u`, and fails the test
 * otherwise. macOS and Windows would find it under either name, but Linux
 * wouldn't, so a test that passes on one would fail on the other.
 */
function judge(options: {
    readonly file: string;
    readonly id: VisualImageId;
    readonly actual: RgbaImage;
    readonly mode: VisualMode;
    readonly testFile?: string;
}): VisualVerdict {
    const { file, id, actual, mode } = options;
    const referenceFile = toDisplayPath(file);
    const testFile = options.testFile === undefined ? undefined : toDisplayPath(options.testFile);
    const isUpdate = isRewriting(mode);
    const twin = id.calibration === undefined ? findCaseTwin(file) : undefined;
    if (twin !== undefined) {
        if (!isUpdate) return { outcome: 'case', referenceFile, caseFile: toDisplayPath(twin), testFile };
        renameSync(twin, file);
    }
    // A renamed reference is reported as updated, so that the summary shows it.
    const same = twin === undefined ? 'same' : 'updated';
    const hash = hashImage(actual);
    const exists = existsSync(file);
    const isWritable = id.calibration !== undefined ? mode === 'environment' : isUpdate || (mode === 'new' && !exists);
    // A run that rewrites references trusts the hash only if the pixels match it.
    const isTrusted = !isWritable || !exists || checkReferences([file], CHECK_CACHE_FILE).get(file) === undefined;
    if (exists && readPngHash(file) === hash && isTrusted) return { outcome: same, referenceFile };

    let expected: RgbaImage | undefined;
    if (exists) expected = readReference({ file, referenceFile, isWritable, testFile });
    const isSameSize = expected !== undefined && expected.width === actual.width && expected.height === actual.height;
    const comparison = expected !== undefined && isSameSize ? compareImages({ expected, actual }) : undefined;
    // The same pixels, in a file that lacks their hash, such as one that a
    // paint program saved. A write adds the hash, so that `-u` repairs it.
    if (comparison?.changed === 0) {
        if (isWritable) writeFileSync(file, encodePng(actual));
        return { outcome: same, referenceFile };
    }
    if (comparison?.isWithinTolerance && !(isWritable && DRAWS_EXACTLY)) {
        return { outcome: 'within-tolerance', changed: comparison.changed, maxDelta: comparison.maxDelta, referenceFile };
    }
    if (isWritable) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, encodePng(actual));
        return { outcome: exists ? 'updated' : 'added', referenceFile };
    }

    const outBase = toOutputBase(file);
    mkdirSync(dirname(outBase), { recursive: true });
    writeFileSync(`${outBase}.actual.png`, encodePng(actual));
    const actualFile = toDisplayPath(`${outBase}.actual.png`);
    const actualImage = { name: 'actual', path: `${outBase}.actual.png`, width: actual.width, height: actual.height } as const;
    if (expected === undefined) return { outcome: 'new', referenceFile, actualFile, testFile, images: [actualImage] };
    const referenceImage = { name: 'reference', path: file, width: expected.width, height: expected.height } as const;
    if (comparison === undefined) {
        return { outcome: 'size', referenceSize: `${expected.width}x${expected.height}`, referenceFile, actualFile, testFile, images: [referenceImage, actualImage] };
    }
    writeFileSync(`${outBase}.diff.png`, encodePng(comparison.diff));
    const diffImage = { name: 'diff', path: `${outBase}.diff.png`, width: actual.width, height: actual.height } as const;
    return {
        images: [referenceImage, actualImage, diffImage],
        outcome: 'differs',
        changed: comparison.exceeded,
        maxDelta: comparison.maxDelta,
        changedRect: comparison.changedRect,
        referenceFile,
        actualFile,
        diffFile: toDisplayPath(`${outBase}.diff.png`),
        testFile,
    };
}

/**
 * Returns the reference image in a file whose name differs from the path's
 * only in case, as an absolute path, if there is one and no file has the
 * path's own name. Only a file that carries a pixel hash counts, so that a
 * PNG that v-snap didn't write is never renamed.
 */
function findCaseTwin(file: string): string | undefined {
    const dir = dirname(file);
    if (!existsSync(dir)) return undefined;
    const name = basename(file);
    const lower = name.toLowerCase();
    let twin: string | undefined;
    for (const entry of readdirSync(dir)) {
        if (entry === name) return undefined;
        if (entry.toLowerCase() === lower) twin = entry;
    }
    return twin === undefined || readPngHash(join(dir, twin)) === undefined ? undefined : join(dir, twin);
}

/**
 * Returns a reference's pixels. A file that can't be decoded throws an error
 * that says what to do, unless the run may rewrite it, when it returns
 * undefined, so that the actual image replaces it. A Git LFS pointer always
 * throws, since the image it stands for is in Git LFS, not missing.
 */
function readReference(options: { readonly file: string; readonly referenceFile: string; readonly isWritable: boolean; readonly testFile: string | undefined }): RgbaImage | undefined {
    const bytes = readFileSync(options.file);
    if (isLfsPointer(bytes)) {
        throw new Error(
            `The reference image ${options.referenceFile} is a Git LFS pointer, not an image, so this checkout doesn't have the images that Git LFS stores. `
            + 'Run git lfs pull, or check out with Git LFS, such as with lfs: true in actions/checkout.',
        );
    }
    try {
        return decodePng(bytes);
    }
    catch (error) {
        if (options.isWritable) return undefined;
        const update = options.testFile === undefined ? 'Vitest with -u' : `npx vitest run ${options.testFile} -u`;
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`The reference image ${options.referenceFile} is not a PNG that can be read (${reason}). Run ${update} to rewrite it from its test.`);
    }
}

/** The part of a DevTools protocol session that this file uses. */
export interface Cdp {
    send: (method: 'Page.captureScreenshot', params: Record<string, unknown>) => Promise<{ data: string }>;
}

/** Returns the page's DevTools protocol session, which is made once for each page. */
function connectCdp(ctx: BrowserCommandContext, cdpSessions: Map<string, Promise<Cdp>>): Promise<Cdp> {
    let cdp = cdpSessions.get(ctx.sessionId);
    if (cdp === undefined) {
        const provider = ctx.provider as unknown as { getCDPSession: (sessionId: string) => Promise<Cdp> };
        cdp = provider.getCDPSession(ctx.sessionId);
        cdpSessions.set(ctx.sessionId, cdp);
    }
    return cdp;
}
