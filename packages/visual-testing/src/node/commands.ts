/**
 * The visual tests' browser commands. A browser command runs in Node, and
 * the test page calls it (the page's side is in `src/browser/judge.ts`).
 * These commands read and write reference pictures. They compare a picture
 * whose hash does not match its reference's hash. They capture HTML
 * pictures through the Chrome DevTools protocol, and they check the
 * environment.
 *
 * A test file's references live beside it, in
 * `__screenshots__/<test file>/<picture name>.png`. The calibration set is
 * a set of small pictures that checks this machine draws like the reference
 * environment. Its references live in this package, in
 * `src/browser/__screenshots__/calibration-<kind>/`. When a picture fails,
 * its actual pixels and its diff are written to `.vitest/visual/` at the
 * repository's root, in the same directory layout as the repository.
 *
 * The run's mode comes from the `VISUAL_MODE` environment variable
 * (`compare`, `update` or `environment`), which `scripts/run.ts` sets.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';
import type {
    VisualCalibration, VisualCaptureRequest, VisualEnvironment, VisualKind, VisualMode, VisualPictureId, VisualPicturePayload, VisualScope,
    VisualSession, VisualVerdict,
} from '../protocol';
import { comparePictures } from './compare';
import { ENVIRONMENT_FILE, findCalibrationDir, OUT_DIR, REPO_ROOT, toDisplayPath } from './paths';
import { decodePng, encodePng, hashPicture, type Picture, readPngHash } from './png';
import { findReferenceDir } from './references';

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const openVisualSession: BrowserCommand<[VisualScope]> = (ctx, scope): VisualSession => {
    const dir = resolveReferenceDir(ctx, scope);
    const hashes: Record<string, string> = {};
    if (existsSync(dir)) {
        for (const file of readdirSync(dir)) {
            if (!file.endsWith('.png')) continue;
            const hash = readPngHash(join(dir, file));
            if (hash !== undefined) hashes[file.slice(0, -4)] = hash;
        }
    }
    return { mode: MODE, hashes, isCalibrated: scope.calibration !== undefined && calibrated.has(scope.calibration) };
};

const recordVisualCalibration: BrowserCommand<[VisualCalibration]> = (_ctx, calibration) => {
    calibrated.add(calibration.kind);
    for (const name of calibration.names) calibrationReferences.add(join(findCalibrationDir(calibration.kind), `${name}.png`));
};

const judgeVisualMismatch: BrowserCommand<[VisualPicturePayload]> = (ctx, payload): VisualVerdict => {
    const pixels = new Uint8Array(Buffer.from(payload.pixels, 'base64'));
    return judge(ctx, payload, { width: payload.width, height: payload.height, pixels });
};

const captureVisualPicture: BrowserCommand<[VisualCaptureRequest]> = async (ctx, request) => {
    const started = performance.now();
    const cdp = await connectCdp(ctx);
    const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { ...request.rect, scale: 1 },
        optimizeForSpeed: true,
        captureBeyondViewport: false,
    });
    const picture = decodePng(Buffer.from(data, 'base64'));
    const captureMs = performance.now() - started;
    return { ...judge(ctx, request, picture), captureMs };
};

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
    if (!existsSync(ENVIRONMENT_FILE)) return [`${toDisplayPath(ENVIRONMENT_FILE)} is missing, and \`npm run test:visual:environment\` writes it`];
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

export const visualCommands = { openVisualSession, judgeVisualMismatch, captureVisualPicture, checkVisualEnvironment, recordVisualCalibration, abortVisualRun };

/**
 * Returns the calibration references that this run compared pictures with.
 * Calibration pictures are drawn while a page is set up, not by tests. So
 * the reporter learns of them here, when it looks for references that no
 * picture was compared with.
 */
export function listComparedCalibrationReferences(): ReadonlySet<string> {
    return calibrationReferences;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MODE = (process.env.VISUAL_MODE ?? 'compare') as VisualMode;

/** The calibration sets that this run checked and found matching, and their references. */
const calibrated = new Set<VisualKind>();
const calibrationReferences = new Set<string>();

interface EnvironmentFile {
    readonly browser: string;
    readonly webgl: string;
    readonly locale: string;
    readonly timeZone: string;
    readonly devicePixelRatio: number;
}

function resolveReferenceDir(ctx: BrowserCommandContext, scope: VisualScope): string {
    if (scope.calibration !== undefined) return findCalibrationDir(scope.calibration);
    const testPath = ctx.testPath;
    if (testPath === undefined) throw new Error('A visual picture was taken outside a test file.');
    return findReferenceDir(testPath);
}

/**
 * The test that makes each reference. It catches two tests whose names give
 * the same file name.
 */
const makers = new Map<string, string>();

/**
 * Compares a picture with its reference, or writes it as the reference.
 * A picture within the tolerance is never rewritten. That way, a machine
 * whose processor rounds a little differently does not keep rewriting the
 * references.
 */
function judge(ctx: BrowserCommandContext, id: VisualPictureId, actual: Picture): VisualVerdict {
    const dir = resolveReferenceDir(ctx, id);
    const file = join(dir, `${id.name}.png`);
    const maker = makers.get(file);
    if (maker !== undefined && maker !== id.test) {
        throw new Error(`The tests '${id.test}' and '${maker}' both make the picture '${id.name}'. Rename one of them.`);
    }
    makers.set(file, id.test);

    const referenceFile = toDisplayPath(file);
    const hash = hashPicture(actual);
    const exists = existsSync(file);
    const isWritable = id.calibration !== undefined ? MODE === 'environment' : MODE !== 'compare';
    if (exists && readPngHash(file) === hash) return { outcome: 'same', referenceFile };

    let expected: Picture | undefined;
    if (exists) expected = decodePng(readFileSync(file));
    const isSameSize = expected !== undefined && expected.width === actual.width && expected.height === actual.height;
    const comparison = expected !== undefined && isSameSize ? comparePictures({ expected, actual }) : undefined;
    if (comparison?.isWithinTolerance) {
        return { outcome: 'within-tolerance', changed: comparison.changed, maxDelta: comparison.maxDelta, referenceFile };
    }
    if (isWritable) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, encodePng(actual));
        return { outcome: 'updated', referenceFile };
    }

    const outBase = join(OUT_DIR, relative(REPO_ROOT, dir), id.name);
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
