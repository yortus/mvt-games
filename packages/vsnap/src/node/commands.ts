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
 * `__references__/<test file>/<image name>.png`. The calibration set is
 * a set of small images that checks this machine draws like the reference
 * environment. Its references live in this package, in
 * `src/browser/__references__/calibration-<kind>/`. When an actual image
 * fails, its pixels and its diff are written to `.vitest/vsnap/` at the
 * repository's root, in the same directory layout as the repository.
 *
 * The run's mode comes from the `VSNAP_MODE` environment variable
 * (`compare`, `update` or `environment`), which `src/node/cli/vsnap.ts` sets.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';
import type {
    VisualCalibration, VisualCaptureRequest, VisualEnvironment, VisualKind, VisualMode, VisualImageId, VisualImagePayload, VisualScope,
    VisualSession, VisualVerdict,
} from '../protocol';
import { compareImages } from './compare';
import { ENVIRONMENT_FILE, findCalibrationDir, OUT_DIR, REPO_ROOT, toDisplayPath } from './paths';
import { matchReferenceName, type ReferencePattern, resolveReferencePath, resolveReferencePattern, type VisualLayout } from './layout';
import { decodePng, encodePng, hashImage, type RgbaImage, readPngHash } from './png';

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
    readonly calibrated: Set<VisualKind>;
    readonly calibrationReferences: Set<string>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a run's state, which a config's commands and reporter share. */
export function createRunState(): VisualRunState {
    return { calibrated: new Set(), calibrationReferences: new Set() };
}

/** Creates the browser commands for a project with this layout. */
export function createVisualCommands(options: { readonly layout: VisualLayout; readonly state: VisualRunState }) {
    const { layout, state } = options;

    const openVisualSession: BrowserCommand<[VisualScope]> = (ctx, scope): VisualSession => {
        const pattern = resolvePattern(ctx, scope);
        const hashes: Record<string, string> = {};
        if (existsSync(pattern.dir)) {
            for (const file of readdirSync(pattern.dir)) {
                const name = matchReferenceName(pattern, file);
                if (name === undefined) continue;
                const hash = readPngHash(join(pattern.dir, file));
                if (hash !== undefined) hashes[name] = hash;
            }
        }
        return { mode: MODE, hashes, isCalibrated: scope.calibration !== undefined && state.calibrated.has(scope.calibration) };
    };

    const recordVisualCalibration: BrowserCommand<[VisualCalibration]> = (_ctx, calibration) => {
        state.calibrated.add(calibration.kind);
        for (const name of calibration.names) state.calibrationReferences.add(join(findCalibrationDir(calibration.kind), `${name}.png`));
    };

    const judgeVisualMismatch: BrowserCommand<[VisualImagePayload]> = (ctx, payload): VisualVerdict => {
        const pixels = new Uint8Array(Buffer.from(payload.pixels, 'base64'));
        return judge(resolveFile(ctx, payload), payload, { width: payload.width, height: payload.height, pixels });
    };

    const captureVisualImage: BrowserCommand<[VisualCaptureRequest]> = async (ctx, request) => {
        const started = performance.now();
        const cdp = await connectCdp(ctx);
        const { data } = await cdp.send('Page.captureScreenshot', {
            format: 'png',
            clip: { ...request.rect, scale: 1 },
            optimizeForSpeed: true,
            captureBeyondViewport: false,
        });
        const actual = decodePng(Buffer.from(data, 'base64'));
        const captureMs = performance.now() - started;
        return { ...judge(resolveFile(ctx, request), request, actual), captureMs };
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

const MODE = (process.env.VSNAP_MODE ?? 'compare') as VisualMode;

const checkVisualEnvironment: BrowserCommand<[VisualEnvironment]> = (_ctx, environment): readonly string[] => {
    const facts: EnvironmentFile = {
        browser: environment.browser,
        webgl: environment.webglRenderer.includes('SwiftShader') ? 'SwiftShader' : environment.webglRenderer,
        locale: environment.locale,
        timeZone: environment.timeZone,
        devicePixelRatio: environment.devicePixelRatio,
    };
    if (MODE === 'environment') {
        writeFileSync(ENVIRONMENT_FILE, JSON.stringify(facts, undefined, 4) + '\n');
        return [];
    }
    if (!existsSync(ENVIRONMENT_FILE)) return [`${toDisplayPath(ENVIRONMENT_FILE)} is missing, and \`npm run test:visual:environment -w vsnap\` writes it`];
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
 * reference. When the actual image is within the tolerance, the reference is
 * never rewritten. That way, a machine
 * whose processor rounds a little differently does not keep rewriting the
 * references.
 */
function judge(file: string, id: VisualImageId, actual: RgbaImage): VisualVerdict {
    const referenceFile = toDisplayPath(file);
    const hash = hashImage(actual);
    const exists = existsSync(file);
    const isWritable = id.calibration !== undefined ? MODE === 'environment' : MODE !== 'compare';
    if (exists && readPngHash(file) === hash) return { outcome: 'same', referenceFile };

    let expected: RgbaImage | undefined;
    if (exists) expected = decodePng(readFileSync(file));
    const isSameSize = expected !== undefined && expected.width === actual.width && expected.height === actual.height;
    const comparison = expected !== undefined && isSameSize ? compareImages({ expected, actual }) : undefined;
    if (comparison?.isWithinTolerance) {
        return { outcome: 'within-tolerance', changed: comparison.changed, maxDelta: comparison.maxDelta, referenceFile };
    }
    if (isWritable) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, encodePng(actual));
        return { outcome: 'updated', referenceFile };
    }

    const outBase = join(OUT_DIR, relative(REPO_ROOT, file)).slice(0, -'.png'.length);
    mkdirSync(dirname(outBase), { recursive: true });
    writeFileSync(`${outBase}.actual.png`, encodePng(actual));
    const actualFile = toDisplayPath(`${outBase}.actual.png`);
    if (expected === undefined) return { outcome: 'new', referenceFile, actualFile };
    if (comparison === undefined) {
        return { outcome: 'size', referenceSize: `${expected.width}x${expected.height}`, referenceFile, actualFile };
    }
    writeFileSync(`${outBase}.diff.png`, encodePng(comparison.diff));
    return {
        outcome: 'differs',
        changed: comparison.changed,
        maxDelta: comparison.maxDelta,
        changedRect: comparison.changedRect,
        referenceFile,
        actualFile,
        diffFile: toDisplayPath(`${outBase}.diff.png`),
    };
}

/** The part of a DevTools protocol session that this file uses. */
interface Cdp {
    send: (method: 'Page.captureScreenshot', params: Record<string, unknown>) => Promise<{ data: string }>;
}

const cdpSessions = new Map<string, Promise<Cdp>>();

/** Returns the page's DevTools protocol session, which is made once for each page. */
function connectCdp(ctx: BrowserCommandContext): Promise<Cdp> {
    let cdp = cdpSessions.get(ctx.sessionId);
    if (cdp === undefined) {
        const provider = ctx.provider as unknown as { getCDPSession: (sessionId: string) => Promise<Cdp> };
        cdp = provider.getCDPSession(ctx.sessionId);
        cdpSessions.set(ctx.sessionId, cdp);
    }
    return cdp;
}
