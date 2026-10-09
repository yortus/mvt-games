/**
 * The visual tests' browser commands: run in Node, called from the page
 * (`src/testing/commands.ts`). They read and write reference pictures,
 * compare a picture that does not match its reference's hash, capture HTML
 * pictures through the DevTools protocol, and check the environment.
 *
 * References live beside their test file, in
 * `__screenshots__/<test file>/<picture name>.png`; the calibration set's in
 * `src/testing/__screenshots__/calibration-<kind>/`. A failing picture's
 * actual pixels and diff go to `.vitest/visual/`, mirroring the repo.
 *
 * The run's mode comes from `VISUAL_MODE` (`compare`, `update` or
 * `environment`), which `run.ts` sets.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node';
import type {
    VisualCalibration, VisualCaptureRequest, VisualEnvironment, VisualKind, VisualMode, VisualPictureId, VisualPicturePayload, VisualScope,
    VisualSession, VisualVerdict,
} from '../../src/testing';
import { comparePictures } from './compare';
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
    if (!existsSync(ENVIRONMENT_FILE)) return [`${relative(REPO, ENVIRONMENT_FILE)} is missing: run \`npm run test:visual:environment\``];
    const expected = JSON.parse(readFileSync(ENVIRONMENT_FILE, 'utf8')) as EnvironmentFile;
    const problems: string[] = [];
    for (const key of Object.keys(expected) as (keyof EnvironmentFile)[]) {
        if (expected[key] !== facts[key]) problems.push(`${key} is ${JSON.stringify(facts[key])}, not ${JSON.stringify(expected[key])}`);
    }
    return problems;
};

const abortVisualRun: BrowserCommand<[string]> = (ctx, message) => {
    console.error(`\n${message}\n`);
    // Not awaited: the cancellation waits for the running file, which is waiting for this command
    void ctx.project.vitest.cancelCurrentRun('test-failure');
};

export const visualCommands = { openVisualSession, judgeVisualMismatch, captureVisualPicture, checkVisualEnvironment, recordVisualCalibration, abortVisualRun };

/**
 * The calibration references this run compared with: calibration pictures
 * are drawn as a page is set up, not by tests, so the reporter learns of
 * them here when it looks for references no picture was compared with.
 */
export function listComparedCalibrationReferences(): ReadonlySet<string> {
    return calibrationReferences;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const WEBSITE = resolve(import.meta.dirname, '..', '..');
const REPO = resolve(WEBSITE, '..', '..');
const OUT = join(REPO, '.vitest', 'visual');
const ENVIRONMENT_FILE = join(WEBSITE, 'visual-environment.json');
const MODE = (process.env.VISUAL_MODE ?? 'compare') as VisualMode;

/** The calibration sets this run has checked and found matching, and their references. */
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
    if (testPath === undefined) throw new Error('A visual picture outside a test file');
    return findReferenceDir(testPath);
}

function findCalibrationDir(kind: VisualKind): string {
    return join(WEBSITE, 'src', 'testing', '__screenshots__', `calibration-${kind}`);
}

/** The test that makes each reference, to catch two tests whose names give one file name. */
const makers = new Map<string, string>();

/**
 * Compares a picture with its reference, or writes it as the reference.
 * A picture within the tolerance is never rewritten, so a machine whose
 * processor rounds a little differently does not churn the references.
 */
function judge(ctx: BrowserCommandContext, id: VisualPictureId, actual: Picture): VisualVerdict {
    const dir = resolveReferenceDir(ctx, id);
    const file = join(dir, `${id.name}.png`);
    const maker = makers.get(file);
    if (maker !== undefined && maker !== id.test) {
        throw new Error(`'${id.test}' and '${maker}' both make the picture '${id.name}': rename one`);
    }
    makers.set(file, id.test);

    const referenceFile = relative(REPO, file).replaceAll('\\', '/');
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

    const outBase = join(OUT, relative(REPO, dir), id.name);
    mkdirSync(dirname(outBase), { recursive: true });
    writeFileSync(`${outBase}.actual.png`, encodePng(actual));
    const actualFile = relative(REPO, `${outBase}.actual.png`).replaceAll('\\', '/');
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
        diffFile: relative(REPO, `${outBase}.diff.png`).replaceAll('\\', '/'),
    };
}

/** What the DevTools protocol session needs to offer. */
interface Cdp {
    send: (method: 'Page.captureScreenshot', params: Record<string, unknown>) => Promise<{ data: string }>;
}

const cdpSessions = new Map<string, Promise<Cdp>>();

/** The page's DevTools protocol session, made once per page. */
function connectCdp(ctx: BrowserCommandContext): Promise<Cdp> {
    let cdp = cdpSessions.get(ctx.sessionId);
    if (cdp === undefined) {
        const provider = ctx.provider as unknown as { getCDPSession: (sessionId: string) => Promise<Cdp> };
        cdp = provider.getCDPSession(ctx.sessionId);
        cdpSessions.set(ctx.sessionId, cdp);
    }
    return cdp;
}
