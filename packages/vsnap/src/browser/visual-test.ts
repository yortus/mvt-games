import { inject, type TaskMeta, test } from 'vitest';
import { type CanvasImage, checkCanvasBudget, isCanvas, readCanvas } from './canvas-drawing';
import { captureHtmlImage, type HtmlImageOptions } from './html-image';
import { describeFailure, hashPixels, isPass, nameImage, openSession, toBase64, visualCommands } from './judge';
import { type PageSetup, setUpPage } from './page-setup';
import type { Pose } from './pose';
import type { VisualTestMeta, VisualVerdict } from '../protocol';
import { describeValue, isAllOne } from '../shared';
import { splitTestOptions, type VitestTestOptions } from './test-options';
import { type CanvasKinds, type CanvasTestOptions, type CanvasViewKind, type DefaultView, loadViewKinds } from './view-kinds';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * `canvasTest`'s forms. The options' `kind` names the kind of view that the
 * pose returns: one that the project's `vsnap.config.ts` registers, or
 * `'canvas'` for a canvas that the pose drew. A test of the config's default
 * view may leave `kind` out, and may leave out its options if they are all
 * optional, as Pixi's are. The options may also hold Vitest's `timeout`,
 * `retry`, `repeats` and `fails`.
 */
export type CanvasTestForms = (<K extends keyof CanvasKinds = DefaultView>(name: string, options: CanvasTestOptions<K> & VitestTestOptions, pose: Pose<CanvasKinds[K]['view']>) => void)
    & (object extends CanvasKinds[DefaultView]['options'] ? (name: string, pose: Pose<CanvasKinds[DefaultView]['view']>) => void : unknown);

/** `htmlTest`'s forms. The options may also hold Vitest's `timeout`, `retry`, `repeats` and `fails`. */
export interface HtmlTestForms {
    (name: string, pose: Pose<Element>): void;
    (name: string, options: HtmlImageOptions & VitestTestOptions, pose: Pose<Element>): void;
}

/** A kind of visual test, with Vitest's modifiers: `.skip`, `.only` and `.todo`, which work as they do on Vitest's `test`. */
export type WithModifiers<F> = F & {
    readonly skip: F;
    readonly only: F;
    readonly todo: (name: string) => void;
};

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Declares a visual test of a view drawn on a canvas. The pose returns a
 * view of the kind that the options name, or of the project's default view:
 * a view of a kind that the project registered, such as a Pixi container,
 * or a canvas that the pose drew. The test checks the view's kind, draws
 * it, and compares the actual image with its reference image,
 * `__references__/<this file>/<describe blocks>-<name>.png`. Canvas tests
 * run in one page that every such file shares, one at a time.
 *
 * A file declares one kind of visual test only, because each kind runs in
 * its own kind of page.
 */
export const canvasTest = withModifiers(declareCanvasTest) as WithModifiers<CanvasTestForms>;

/**
 * Declares a visual test of an HTML view. The test prepares the element
 * that the pose returns, as the project's `vsnap.config.ts` says, captures
 * it, and compares the actual image with its reference image,
 * `__references__/<this file>/<describe blocks>-<name>.png`. Each file of
 * HTML tests runs in a page of its own, because a stylesheet stays in a
 * page once it is imported. The view's text is drawn blank, so its layout
 * and styling show.
 *
 * A file declares one kind of visual test only, because each kind runs in
 * its own kind of page.
 */
export const htmlTest = withModifiers(declareHtmlTest) as WithModifiers<HtmlTestForms>;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type ImageId = ReturnType<typeof nameImage>;

/** Vitest's `test`, or one of its modifiers, `test.skip` and `test.only`, which declares a test as `test` does. */
type Declare = typeof test.skip;

/** A function that declares one kind of visual test with one of Vitest's declarers. */
type DeclareVisualTest = (declare: Declare, name: string, optionsOrPose: object | Pose<unknown>, pose?: Pose<unknown>) => void;

/** Returns a kind of visual test, with `.skip`, `.only` and `.todo`, from the function that declares it. */
function withModifiers(declareVisualTest: DeclareVisualTest): unknown {
    const create = (declare: Declare) => (name: string, optionsOrPose: object | Pose<unknown>, pose?: Pose<unknown>): void => {
        declareVisualTest(declare, name, optionsOrPose, pose);
    };
    return Object.assign(create(test), {
        skip: create(test.skip),
        only: create(test.only),
        todo: (name: string) => test.todo(name),
    });
}

function declareHtmlTest(declare: Declare, name: string, optionsOrPose: object | Pose<unknown>, pose?: Pose<unknown>): void {
    const [elementPose, options] = sortArguments(optionsOrPose, pose);
    const { test: testOptions, image } = splitTestOptions(options);
    declare(name, testOptions, async ({ task }) => {
        const { id } = await startTest(task, 'html');
        const kind = (await loadViewKinds()).html;
        const ms: Record<string, number> = {};
        let t = performance.now();
        const view: unknown = await elementPose();
        ms.pose = performance.now() - t;
        if (!(view instanceof Element)) {
            throw new Error(`'${id.test}' poses ${describeValue(view)}, which is not an HTML element. A view drawn on a canvas is tested with canvasTest.`);
        }
        let captured: Awaited<ReturnType<typeof captureHtmlImage>>;
        try {
            t = performance.now();
            kind.prepare?.(view);
            ms.prepare = performance.now() - t;
            captured = await captureHtmlImage(view, { ...(image as HtmlImageOptions), maxPixels: inject('visualMaxPixels') }, id);
            ms.capture = captured.captureMs;
        }
        finally {
            if (kind.dispose === undefined) view.remove();
            else kind.dispose(view);
        }
        finishTest(task.meta, { id, verdict: captured, kind: 'html', size: { ...captured, resolution: 1 }, ms });
    });
}

/** Sets the page up, names the test's image, and checks that the test runs in its kind of page. */
async function startTest(task: { readonly fullTestName: string; readonly meta: TaskMeta }, declared: 'canvas' | 'html'): Promise<{ readonly setup: PageSetup; readonly id: ImageId }> {
    const setup = await setUpPage();
    const id = nameImage(task.fullTestName);
    task.meta.visualImage = id.name;
    const kind = inject('visualKind');
    if (kind !== declared) {
        // The config sends each file to the page its declarations ask for,
        // so this happens only if the declarations are hidden from it
        throw new Error(`'${id.test}' is ${declared === 'html' ? 'an HTML' : 'a canvas'} visual test, but its file runs in the ${kind} page. A file declares one kind of visual test only.`);
    }
    return { setup, id };
}

/** Records a test's outcome and timings for the run's summary, and fails the test if its image differs. */
function finishTest(meta: TaskMeta, result: {
    readonly id: ImageId;
    readonly verdict: VisualVerdict;
    readonly kind: 'canvas' | 'html';
    readonly size: { readonly width: number; readonly height: number; readonly resolution: number };
    readonly ms: Record<string, number>;
}): void {
    const { id, verdict, kind, size, ms } = result;
    const visual: VisualTestMeta = { kind, outcome: verdict.outcome, width: size.width, height: size.height, resolution: size.resolution, ms };
    meta.visual = visual;
    if (!isPass(verdict)) throw new Error(describeFailure(id.name, verdict, kind));
}

/**
 * Returns a declaration's pose and options, in that order. A declaration
 * takes its options before its pose, as Vitest's `test` does, or its pose
 * alone.
 */
function sortArguments<P extends Pose<unknown>, O extends object>(optionsOrPose: O | P, pose: P | undefined): [P, O | Record<never, never>] {
    if (typeof optionsOrPose === 'function') return [optionsOrPose as P, {}];
    if (pose === undefined) throw new Error('A visual test with options needs a pose after them.');
    return [pose, optionsOrPose];
}

function declareCanvasTest(declare: Declare, name: string, optionsOrPose: object | Pose<unknown>, pose?: Pose<unknown>): void {
    const [viewPose, options] = sortArguments(optionsOrPose, pose);
    const { test: testOptions, image } = splitTestOptions(options);
    const { kind: kindName, ...imageOptions } = image as { readonly kind?: string };
    declare(name, testOptions, async ({ task }) => {
        const { setup, id } = await startTest(task, 'canvas');
        const viewKinds = await loadViewKinds();
        const named = kindName ?? viewKinds.defaultView;
        const kind = named === 'canvas' ? undefined : findKind(viewKinds, named, id.test);
        const ms: Record<string, number> = {};
        kind?.beforePose?.(imageOptions);
        let t = performance.now();
        const posed: unknown = await viewPose();
        ms.pose = performance.now() - t;
        let image: CanvasImage;
        let blankHint = '';
        if (kind === undefined) {
            if (!isCanvas(posed)) throw rejectView({ viewKinds, named, isDefault: kindName === undefined, view: posed, test: id.test });
            t = performance.now();
            checkCanvasBudget(posed, inject('visualMaxPixels'));
            image = readCanvas(posed);
            ms.draw = performance.now() - t;
        }
        else {
            if (!kind.isView(posed)) throw rejectView({ viewKinds, named, isDefault: kindName === undefined, view: posed, test: id.test });
            image = await drawView(kind, posed, imageOptions, ms);
            blankHint = kind.blankHint === undefined ? '' : ` ${kind.blankHint}`;
        }
        if (isAllOne(image.pixels)) {
            throw new Error(`The actual image '${id.name}' is blank. The view drew nothing inside it.${blankHint}`);
        }
        const unpinned = setup.takeUnpinnedFamilies();
        if (unpinned.length > 0) {
            throw new Error(`The view in '${id.test}' asks for fonts that visual tests can't draw: ${unpinned.join(', ')}. End each font list with sans-serif or monospace, and the text is drawn in the test font of that kind. Or add the names to SANS_FAMILIES or MONO_FAMILIES in src/browser/canvas-text.ts, in the vsnap package.`);
        }
        t = performance.now();
        const hash = await hashPixels(image.width, image.height, image.pixels);
        ms.hash = performance.now() - t;
        const session = await openSession({});
        t = performance.now();
        const verdict: VisualVerdict = session.hashes[id.name] === hash
            ? { outcome: 'same', referenceFile: id.name }
            : await visualCommands.judgeVisualMismatch({ ...id, width: image.width, height: image.height, hash, pixels: toBase64(image.pixels) });
        ms.compare = performance.now() - t;
        finishTest(task.meta, { id, verdict, kind: 'canvas', size: image, ms });
    });
}

/** Returns the registered kind of view with a name, and throws if there is none. */
function findKind(viewKinds: Awaited<ReturnType<typeof loadViewKinds>>, name: string, test: string): CanvasViewKind<unknown, object> {
    const kind = viewKinds.canvas.find((candidate) => candidate.name === name);
    if (kind !== undefined) return kind;
    if (!viewKinds.hasConfig) {
        throw new Error(`'${test}' is of the kind '${name}', but vsnap looks for the project's kinds of view in ${viewKinds.configFile}, which doesn't exist. Create the file, and register the kind, such as pixiViews() from 'vsnap/pixi'.`);
    }
    const names = viewKinds.canvas.map((candidate) => candidate.name).join(', ');
    throw new Error(`'${test}' is of the kind '${name}', but ${viewKinds.configFile} registers no kind of view with that name. It registers ${names === '' ? 'none' : names}.`);
}

/**
 * Returns the error for a view that is not of the kind that its test is of.
 * First it disposes of the view, if a registered kind claims it, so that a
 * rejected view doesn't stay in the page that the tests share. A canvas is
 * the pose's own, which it may draw on again, so it is left alone.
 */
function rejectView(options: Parameters<typeof describeMismatch>[0]): Error {
    const error = new Error(describeMismatch(options));
    const claimant = isCanvas(options.view) ? undefined : options.viewKinds.canvas.find((kind) => kind.isView(options.view));
    try {
        claimant?.dispose(options.view);
    }
    catch {
        // The error about the view's kind matters more than one from
        // disposing of it
    }
    return error;
}

/**
 * Describes a view that is not of the kind that its test is of, and says
 * what to do. If another kind claims the view, it suggests that kind.
 */
function describeMismatch(options: {
    readonly viewKinds: Awaited<ReturnType<typeof loadViewKinds>>;
    readonly named: string;
    readonly isDefault: boolean;
    readonly view: unknown;
    readonly test: string;
}): string {
    const { viewKinds, named, isDefault, view, test } = options;
    const expected = named === 'canvas' ? 'a canvas' : `a view of the kind '${named}'`;
    const where = viewKinds.hasConfig ? ` in ${viewKinds.configFile}` : '';
    const why = isDefault ? ` The test gives no kind, so it is of the default view${where}, '${named}'.` : '';
    const claimant = isCanvas(view) ? 'canvas' : viewKinds.canvas.find((kind) => kind.isView(view))?.name;
    let fix: string;
    if (claimant !== undefined) {
        fix = ` The view is of the kind '${claimant}', so give the test { kind: '${claimant}' }.`;
    }
    else if (!viewKinds.hasConfig) {
        fix = ` vsnap looks for the project's kinds of view in ${viewKinds.configFile}, which doesn't exist. Create the file, and register the view's kind, such as pixiViews() from 'vsnap/pixi'.`;
    }
    else {
        const names = viewKinds.canvas.map((kind) => kind.name).join(', ');
        fix = ` No kind that ${viewKinds.configFile} registers (${names === '' ? 'none' : names}) claims it. Register its kind. If it is registered, the project may have a second copy of its library.`;
    }
    return `'${test}' poses ${describeValue(view)}, which is not ${expected}.${why}${fix}`;
}

/** Prepares a view as its kind says, draws it, and disposes of it. */
async function drawView(kind: CanvasViewKind<unknown, object>, view: unknown, options: object, ms: Record<string, number>): Promise<CanvasImage> {
    try {
        let t = performance.now();
        kind.prepare?.(view);
        ms.prepare = performance.now() - t;
        t = performance.now();
        const maxPixels = inject('visualMaxPixels');
        const drawn = await kind.draw(view, { ...options, maxPixels });
        let image: CanvasImage;
        if (isCanvas(drawn)) {
            checkCanvasBudget(drawn, maxPixels);
            image = readCanvas(drawn);
        }
        else {
            image = drawn;
        }
        ms.draw = performance.now() - t;
        return image;
    }
    finally {
        kind.dispose(view);
    }
}
