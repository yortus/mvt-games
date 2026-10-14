import { inject, recordArtifact, type TaskMeta, test, type TestContext, type TestOptions } from 'vitest';
import { type CanvasImage, checkCanvasBudget, isCanvas, readCanvas } from './canvas-drawing';
import { pointAtDeclaration } from './declaration';
import { captureHtmlImage, type HtmlImageOptions } from './html-image';
import { describeFailure, hashPixels, isPass, nameImage, openSession, toBase64, visualCommands } from './judge';
import { type PageSetup, setUpPage } from './page-setup';
import type { Pose } from './pose';
import type { PageKind, VisualTestMeta, VisualVerdict } from '../protocol';
import { describeValue, isAllOne } from '../shared';
import { splitTestOptions, type VitestTestOptions } from './test-options';
import {
    type CanvasKinds, type CanvasViewKind, type DefaultKind, type KindOptions, applyDefaults, loadViewKinds, type OptionsOf, type RegisteredConfig, type ViewOf, type VsnapConfig,
} from './view-kinds';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * `canvasTest`'s forms. The options' `kind` names the kind of view that the
 * pose returns: one that the project's `vsnap.config.ts` registers, or
 * `'canvas'` for a canvas that the pose drew. A test of the config's default
 * view may leave `kind` out, and may leave out its options if they are all
 * optional, as Pixi's are. The options may also hold Vitest's `timeout`,
 * `retry`, `repeats` and `fails`. By default, the config is the one that the
 * project registered.
 */
export type CanvasTestForms<A extends readonly unknown[] = [], C extends VsnapConfig = RegisteredConfig> =
    & (<K extends keyof CanvasKinds<C> = DefaultKind<C>>(name: string, options: KindOptions<C, K> & CanvasTestExtras, pose: CasePose<ViewOf<C, K>, A>) => void)
    & (object extends OptionsOf<C, DefaultKind<C>> ? (name: string, pose: CasePose<ViewOf<C, DefaultKind<C>>, A>) => void : unknown);

/** `htmlTest`'s forms. The options may also hold Vitest's `timeout`, `retry`, `repeats` and `fails`. */
export interface HtmlTestForms<A extends readonly unknown[] = []> {
    (name: string, pose: CasePose<Element, A>): void;
    (name: string, options: HtmlImageOptions & VitestTestOptions, pose: CasePose<Element, A>): void;
}

/** The options of a canvas test that are neither its kind's nor Vitest's. */
export interface CanvasTestExtras extends VitestTestOptions {
    /**
     * Whether the image may be one colour all over. By default, such an image
     * fails, since it usually means that the view drew nothing. A view that
     * is meant to be one colour, such as an empty panel, sets this.
     */
    readonly canBeBlank?: boolean;
}

/**
 * A pose that takes the arguments of a case, for `.each` and `.for`, which
 * declare one test for each case of a table. A plain pose takes none.
 */
export type CasePose<V, A extends readonly unknown[]> = (...args: A) => V | Promise<V>;

/**
 * A kind of visual test, with Vitest's modifiers, which work as they do on
 * Vitest's `test`. `D` is the kind's declarer, with `each` and `for`, which
 * each modifier but `todo` gives too, as in `canvasTest.skip.each(cases)`.
 */
export type WithModifiers<D> = D & {
    readonly skip: D;
    readonly only: D;
    readonly todo: (name: string) => void;
    /** Skips the test when the condition is true, as Vitest's `test.skipIf` does. */
    readonly skipIf: (condition: unknown) => D;
    /** Runs the test only when the condition is true, as Vitest's `test.runIf` does. */
    readonly runIf: (condition: unknown) => D;
};

/**
 * `canvasTest`'s forms, with `.each` and `.for`. `.each(cases)` declares a
 * test for each case, and passes the case to the pose, spread if it is an
 * array, as Vitest's `test.each` does. `.for(cases)` passes each case
 * whole, as `test.for` does. The name can show the case, as Vitest's names
 * do, with `%s` or `$property`.
 */
export type CanvasTestDeclarer<C extends VsnapConfig = RegisteredConfig> = CanvasTestForms<[], C> & {
    readonly each: <const T>(cases: readonly T[]) => CanvasTestForms<CaseArgs<T>, C>;
    readonly for: <const T>(cases: readonly T[]) => CanvasTestForms<[T], C>;
};

/** `htmlTest`'s forms, with `.each` and `.for`, which work as they do on `canvasTest`. */
export type HtmlTestDeclarer = HtmlTestForms & {
    readonly each: <const T>(cases: readonly T[]) => HtmlTestForms<CaseArgs<T>>;
    readonly for: <const T>(cases: readonly T[]) => HtmlTestForms<[T]>;
};

/** `canvasTest`, with Vitest's modifiers. By default, its types know the config that the project registered. */
export type CanvasTestAPI<C extends VsnapConfig = RegisteredConfig> = WithModifiers<CanvasTestDeclarer<C>>;

/** `htmlTest`, with Vitest's modifiers. */
export type HtmlTestAPI = WithModifiers<HtmlTestDeclarer>;

/** The arguments that `.each` passes for a case: the case's items if it is an array, as Vitest's `test.each` spreads them, or else the case. */
export type CaseArgs<T> = T extends readonly unknown[] ? [...T] : [T];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Declares a visual test of a view drawn on a canvas. The pose returns a
 * view of the kind that the options name, or of the project's default kind:
 * a view of a kind that the project registered, such as a Pixi container,
 * or a canvas that the pose drew. The test checks the view's kind, draws
 * it, and compares the actual image with its reference image, by default
 * `<this file's stem>.<describe blocks>-<name>.png` beside it. Canvas tests
 * run in one page that every such file shares, one at a time.
 *
 * A file declares one kind of visual test only, because each kind runs in
 * its own kind of page.
 */
export const canvasTest = withModifiers((declare, name, optionsOrPose, pose) => declareCanvasTest({ declare, name, optionsOrPose, pose })) as CanvasTestAPI;

/**
 * Returns `canvasTest`, with types that know one config's kinds of view and
 * default kind, in place of the config that the project registered. A
 * project's `vsnap.config.ts` exports it, and its tests import it from
 * there. A monorepo whose packages have configs of their own needs this,
 * because one TypeScript program holds one `Register`.
 *
 * Each test checks that v-snap loaded this config for the test's project, so
 * a test that imports another package's `canvasTest` fails.
 */
export function bindCanvasTest<const C extends VsnapConfig>(config: C): CanvasTestAPI<C> {
    return withModifiers((declare, name, optionsOrPose, pose) => declareCanvasTest({ declare, name, optionsOrPose, pose, config })) as CanvasTestAPI<C>;
}

/**
 * Declares a visual test of an HTML view. The test prepares the element
 * that the pose returns, as the project's `vsnap.config.ts` says, captures
 * it, and compares the actual image with its reference image, by default
 * `<this file's stem>.<describe blocks>-<name>.png` beside it. Each file of
 * HTML tests runs in a page of its own, because a stylesheet stays in a
 * page once it is imported. The view's text is drawn blank, so its layout
 * and styling show.
 *
 * A file declares one kind of visual test only, because each kind runs in
 * its own kind of page.
 */
export const htmlTest = withModifiers(declareHtmlTest) as HtmlTestAPI;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type ImageId = ReturnType<typeof nameImage>;

/**
 * The start of the URLs of v-snap's modules in the test page: the folder that
 * holds `browser/`, `pixi/`, `three/` and `shared/`, whether it is the
 * package's source or its build.
 */
const OWN_BASE = new URL('..', import.meta.url).href;

/** Vitest's `test`, or one of its modifiers, `test.skip` and `test.only`, which declares a test as `test` does. */
/** A pose of any test, which takes its case's arguments, if it has a case. */
type AnyPose = (...args: readonly unknown[]) => unknown;

/**
 * Declares a test with one of Vitest's declarers. The test's function gets
 * the arguments of its case, which a plain test has none of, and the test's
 * context.
 */
type Declare = (name: string, options: TestOptions, fn: (args: readonly unknown[], context: TestContext) => Promise<void>) => void;

/** A function that declares one kind of visual test with a declarer. */
type DeclareVisualTest = (declare: Declare, name: string, optionsOrPose: object | AnyPose, pose?: AnyPose) => void;

/**
 * Returns a kind of visual test, with Vitest's modifiers, from the function
 * that declares it. Each declaration keeps its stack, the call in the test
 * file, so that an error that v-snap throws points there.
 */
function withModifiers(declareVisualTest: DeclareVisualTest): unknown {
    const create = (declare: Declare) => (name: string, optionsOrPose: object | AnyPose, pose?: AnyPose): void => {
        const declaration = new Error().stack;
        const pointed: Declare = (testName, options, fn) => declare(testName, options, async (args, context) => {
            try {
                await fn(args, context);
            }
            catch (error) {
                throw pointAtDeclaration(error, { declaration, ownBase: OWN_BASE });
            }
        });
        declareVisualTest(pointed, name, optionsOrPose, pose);
    };
    const plain = (declareTest: typeof test.skip): Declare => (name, options, fn) => declareTest(name, options, (context) => fn([], context));
    const forCases = (declareTest: typeof test.skip, cases: readonly unknown[], isSpread: boolean): Declare => (name, options, fn) => {
        declareTest.for(cases)(name, options, (item, context) => fn(isSpread && Array.isArray(item) ? item : [item], context));
    };
    // A declarer, with `each` and `for`, from one of Vitest's.
    const declarer = (declareTest: typeof test.skip) => Object.assign(create(plain(declareTest)), {
        each: (cases: readonly unknown[]) => create(forCases(declareTest, cases, true)),
        for: (cases: readonly unknown[]) => create(forCases(declareTest, cases, false)),
    });
    return Object.assign(declarer(test), {
        skip: declarer(test.skip),
        only: declarer(test.only),
        skipIf: (condition: unknown) => declarer(test.skipIf(condition) as typeof test.skip),
        runIf: (condition: unknown) => declarer(test.runIf(condition) as typeof test.skip),
        todo: (name: string) => test.todo(name),
    });
}

function declareHtmlTest(declare: Declare, name: string, optionsOrPose: object | AnyPose, pose?: AnyPose): void {
    const [elementPose, options] = sortArguments(optionsOrPose, pose);
    const { test: testOptions, image } = splitTestOptions(options);
    declare(name, testOptions, async (args, { task }) => {
        const { id } = await startTest(task, 'html');
        const kind = (await loadViewKinds()).html;
        const ms: Record<string, number> = {};
        const t = performance.now();
        const view: unknown = await elementPose(...args);
        ms.pose = performance.now() - t;
        if (view === undefined) throw new Error(describeNothingPosed(id.test));
        if (!(view instanceof Element)) {
            throw new Error(`'${id.test}' poses ${describeValue(view)}, which is not an HTML element. A view drawn on a canvas is tested with canvasTest.`);
        }
        let captured: Awaited<ReturnType<typeof captureHtmlImage>>;
        try {
            // The capture prepares the element once it is in the page, so that
            // a prepare step that measures it sees its layout
            captured = await captureHtmlImage(view, { ...applyDefaults({ background: kind.background }, image as HtmlImageOptions), maxPixels: inject('vsnapMaxPixels'), prepare: kind.prepare }, id);
            ms.prepare = captured.prepareMs;
            ms.capture = captured.captureMs;
        }
        finally {
            if (kind.dispose === undefined) view.remove();
            else kind.dispose(view);
        }
        await finishTest(task, { id, verdict: captured, pageKind: 'html', size: { ...captured, resolution: 1 }, ms });
    });
}

/** Sets the page up, names the test's image, and checks that the test runs in its kind of page. */
async function startTest(task: { readonly id: string; readonly fullTestName: string; readonly meta: TaskMeta }, declared: PageKind): Promise<{ readonly setup: PageSetup; readonly id: ImageId }> {
    const setup = await setUpPage();
    const id = nameImage(task.fullTestName);
    task.meta.vsnap = { image: id.name };
    claimImageName(task.id, id);
    const pageKind = inject('vsnapPageKind');
    if (pageKind !== declared) {
        // The config sends each file to the page its declarations ask for,
        // so this happens only if the declarations are hidden from it
        throw new Error(`'${id.test}' is ${declared === 'html' ? 'an HTML' : 'a canvas'} visual test, but its file runs in the ${pageKind} page. A file declares one kind of visual test only.`);
    }
    return { setup, id };
}

/**
 * Forgets the image names that the running file's tests claimed. The setup
 * file calls it as each test file starts, since canvas test files share
 * one page.
 */
export function forgetImageNames(): void {
    imageNames.clear();
}

/** The image names that the running file's tests claimed, in lower case, with the test that claimed each. */
const imageNames = new Map<string, { readonly taskId: string; readonly test: string }>();

/**
 * Throws if another test of the file has claimed the same image name, so
 * that the two would share one reference image, and each would overwrite
 * the other's. Names that differ only in punctuation give one image name,
 * and names that differ only in case give one file on macOS and Windows. A
 * test that runs again, by `retry` or `repeats`, is the same test.
 */
function claimImageName(taskId: string, id: ImageId): void {
    const key = id.name.toLowerCase();
    const owner = imageNames.get(key);
    if (owner !== undefined && owner.taskId !== taskId) {
        throw new Error(`'${id.test}' and '${owner.test}' have one reference image, '${id.name}', since their names differ only in punctuation or case, so each would overwrite the other's. Rename one.`);
    }
    imageNames.set(key, { taskId, test: id.test });
}

/** Records a test's outcome and timings for the run's summary, and fails the test if its image differs. */
async function finishTest(task: TestContext['task'], result: {
    readonly id: ImageId;
    readonly verdict: VisualVerdict;
    readonly pageKind: PageKind;
    readonly size: { readonly width: number; readonly height: number; readonly resolution: number };
    readonly ms: Record<string, number>;
}): Promise<void> {
    const { id, verdict, pageKind, size, ms } = result;
    const visual: VisualTestMeta = { pageKind, outcome: verdict.outcome, width: size.width, height: size.height, resolution: size.resolution, ms };
    task.meta.vsnap = { image: id.name, result: visual };
    if (isPass(verdict)) return;
    const message = describeFailure(id.name, verdict, pageKind);
    if (verdict.images !== undefined && verdict.images.length > 0) {
        // The same record as Vitest's own screenshot assertion makes, so that
        // its UI and reports show the reference, actual and diff images. Its
        // type is one of Vitest's own, which Vitest's types declare but its
        // documentation doesn't promise; it is the only one whose images the
        // UI shows side by side. v-snap's peer range keeps to Vitest 5, and a
        // change to it in Vitest would show in the UI, not in a run's result.
        await recordArtifact(task, {
            type: 'internal:toMatchScreenshot',
            kind: 'visual-regression',
            message,
            attachments: verdict.images.map((image) => ({ ...image, contentType: 'image/png' })),
        });
    }
    throw new Error(message);
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

function declareCanvasTest(options: {
    readonly declare: Declare;
    readonly name: string;
    readonly optionsOrPose: object | AnyPose;
    readonly pose: AnyPose | undefined;
    /** The config that `bindCanvasTest` bound this `canvasTest` to, if it did. */
    readonly config?: VsnapConfig;
}): void {
    const { declare, name, config } = options;
    const [viewPose, testAndImageOptions] = sortArguments(options.optionsOrPose, options.pose);
    const { test: testOptions, image } = splitTestOptions(testAndImageOptions);
    const { kind: kindName, canBeBlank, ...testImageOptions } = image as { readonly kind?: string; readonly canBeBlank?: boolean };
    declare(name, testOptions, async (args, { task }) => {
        const { setup, id } = await startTest(task, 'canvas');
        const viewKinds = await loadViewKinds();
        if (config !== undefined && config !== viewKinds.config) {
            throw new Error(`'${id.test}' takes canvasTest from a config other than ${viewKinds.configFile}, which is this project's. Import canvasTest from this project's config.`);
        }
        const named = kindName ?? viewKinds.defaultKind;
        const kind = named === 'canvas' ? undefined : findKind(viewKinds, named, id.test);
        const ms: Record<string, number> = {};
        // The kind's defaults, such as the project's background, under the test's own options.
        const imageOptions = applyDefaults(kind?.defaults, testImageOptions);
        kind?.beforePose?.(imageOptions);
        let t = performance.now();
        const posed: unknown = await viewPose(...args);
        ms.pose = performance.now() - t;
        let image: CanvasImage;
        let blankHint = '';
        if (kind === undefined) {
            if (!isCanvas(posed)) throw rejectView({ viewKinds, named, isDefault: kindName === undefined, view: posed, test: id.test });
            t = performance.now();
            checkCanvasBudget(posed, inject('vsnapMaxPixels'));
            image = readCanvas(posed);
            ms.draw = performance.now() - t;
        }
        else {
            if (!kind.isView(posed)) throw rejectView({ viewKinds, named, isDefault: kindName === undefined, view: posed, test: id.test });
            image = await drawView(kind, posed, imageOptions, ms);
            blankHint = kind.blankHint === undefined ? '' : ` ${kind.blankHint}`;
        }
        if (canBeBlank !== true && isAllOne(image.pixels)) {
            throw new Error(`The actual image '${id.name}' is blank. The view drew nothing inside it.${blankHint} A view that is meant to be one colour sets canBeBlank: true.`);
        }
        const unpinned = setup.takeUnpinnedFamilies();
        if (unpinned.length > 0) {
            throw new Error(`The view in '${id.test}' asks for fonts that visual tests can't draw: ${unpinned.join(', ')}. End each font list with sans-serif or monospace, and the text is drawn in the test font of that kind.`);
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
        await finishTest(task, { id, verdict, pageKind: 'canvas', size: image, ms });
    });
}

/** Returns the registered kind of view with a name, and throws if there is none. */
function findKind(viewKinds: Awaited<ReturnType<typeof loadViewKinds>>, name: string, test: string): CanvasViewKind<unknown, object> {
    const kind = viewKinds.canvas.find((candidate) => candidate.kind === name);
    if (kind !== undefined) return kind;
    if (!viewKinds.hasConfig) {
        throw new Error(`'${test}' is of the kind '${name}', but v-snap looks for the project's kinds of view in ${viewKinds.configFile}, which doesn't exist. Create the file, and register the kind, such as pixiViews() from 'v-snap/pixi'.`);
    }
    const names = viewKinds.canvas.map((candidate) => candidate.kind).join(', ');
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
        claimant?.dispose?.(options.view);
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
    if (view === undefined) return describeNothingPosed(test);
    const expected = named === 'canvas' ? 'a canvas' : `a view of the kind '${named}'`;
    const where = viewKinds.hasConfig ? ` in ${viewKinds.configFile}` : '';
    const why = isDefault ? ` The test gives no kind, so it is of the default kind${where}, '${named}'.` : '';
    const claimant = isCanvas(view) ? 'canvas' : viewKinds.canvas.find((kind) => kind.isView(view))?.kind;
    let fix: string;
    if (claimant !== undefined) {
        fix = ` The view is of the kind '${claimant}', so give the test { kind: '${claimant}' }.`;
    }
    else if (!viewKinds.hasConfig) {
        fix = ` v-snap looks for the project's kinds of view in ${viewKinds.configFile}, which doesn't exist. Create the file, and register the view's kind, such as pixiViews() from 'v-snap/pixi'.`;
    }
    else {
        const names = viewKinds.canvas.map((kind) => kind.kind).join(', ');
        fix = ` No kind that ${viewKinds.configFile} registers (${names === '' ? 'none' : names}) claims it. Register its kind. If it is registered, the project may have a second copy of its library.`;
    }
    return `'${test}' poses ${describeValue(view)}, which is not ${expected}.${why}${fix}`;
}

/** Describes a pose that returned nothing, which is usually one that forgot to return its view. */
function describeNothingPosed(test: string): string {
    return `'${test}' poses undefined. A pose returns its view, so a pose with a block body ends with return.`;
}

/** Prepares a view as its kind says, draws it, and disposes of it. */
async function drawView(kind: CanvasViewKind<unknown, object>, view: unknown, options: object, ms: Record<string, number>): Promise<CanvasImage> {
    try {
        let t = performance.now();
        kind.prepare?.(view);
        ms.prepare = performance.now() - t;
        t = performance.now();
        const maxPixels = inject('vsnapMaxPixels');
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
        kind.dispose?.(view);
    }
}
