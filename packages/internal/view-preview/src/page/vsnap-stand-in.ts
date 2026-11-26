// What `v-snap` is in the preview. A test file's `canvasTest` and `htmlTest`
// calls record each test, with its options and pose, for the preview to run.
// They don't declare Vitest tests, since the preview page doesn't run Vitest.
// A site's `vsnap.config.ts` imports `defineVsnapConfig` and `htmlViews`
// from here too.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** One test that a test file declared, as the preview runs it. */
export interface RecordedTest {
    /** Its whole name, after the names of any `describe` blocks round it. */
    readonly name: string;
    readonly kind: 'canvas' | 'html';
    readonly options: Readonly<Record<string, unknown>>;
    readonly pose: (...args: readonly unknown[]) => unknown;
    /** The arguments of its case, for a test declared with `.each` or `.for`. */
    readonly args: readonly unknown[];
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export const canvasTest = createDeclarer('canvas');
export const htmlTest = createDeclarer('html');

export function bindCanvasTest(_config: unknown): typeof canvasTest {
    return canvasTest;
}

export function defineVsnapConfig<C>(config: C): C {
    return config;
}

export function htmlViews(options: object = {}): object {
    return { kind: 'html', ...options };
}

/** Starts recording the tests that the next test file declares as it loads. */
export function startRecording(): void {
    recorder.tests = [];
    recorder.describes = [];
    recorder.pending = [];
}

/**
 * Returns the tests recorded since `startRecording`, once the file has
 * loaded. It runs the bodies of the file's `describe` blocks first, which
 * waited for the file to load, as they do in Vitest. A body may use a
 * constant declared below its block, which only exists once the whole
 * module has run.
 */
export function takeRecordedTests(): readonly RecordedTest[] {
    for (let i = 0; i < recorder.pending.length; i++) {
        const { names, body } = recorder.pending[i];
        recorder.describes = names;
        body();
    }
    recorder.pending = [];
    recorder.describes = [];
    const tests = recorder.tests;
    recorder.tests = [];
    return tests;
}

/** Notes a `describe` block's body, to run once its file has loaded. The tests it declares then have its name before theirs. */
export function describeTests(name: string, body: () => void): void {
    recorder.pending.push({ names: [...recorder.describes, name], body });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type AnyPose = (...args: readonly unknown[]) => unknown;

interface PendingDescribe {
    /** The names of the block and the blocks round it, outermost first. */
    readonly names: readonly string[];
    readonly body: () => void;
}

const recorder: { tests: RecordedTest[]; describes: readonly string[]; pending: PendingDescribe[] } = { tests: [], describes: [], pending: [] };

/** Returns a declarer with Vitest's modifiers and `.each` and `.for`, each of which records its tests the same way. */
function createDeclarer(kind: RecordedTest['kind']): unknown {
    const declare = (cases: readonly unknown[] | undefined, isSpread: boolean) => (name: string, optionsOrPose: object | AnyPose, pose?: AnyPose): void => {
        const fn = typeof optionsOrPose === 'function' ? optionsOrPose as AnyPose : pose;
        const options = (typeof optionsOrPose === 'function' ? {} : optionsOrPose) as Record<string, unknown>;
        if (fn === undefined) return;
        if (cases === undefined) {
            record({ name, kind, options, pose: fn, args: [] });
            return;
        }
        cases.forEach((item, index) => {
            const args = isSpread && Array.isArray(item) ? item : [item];
            record({ name: formatCaseName({ name, item, index }), kind, options, pose: fn, args });
        });
    };
    const declarer = () => Object.assign(declare(undefined, false), {
        each: (cases: readonly unknown[]) => declare(cases, true),
        for: (cases: readonly unknown[]) => declare(cases, false),
    });
    return Object.assign(declarer(), {
        skip: declarer(),
        only: declarer(),
        todo: () => undefined,
        skipIf: () => declarer(),
        runIf: () => declarer(),
    });
}

function record(test: RecordedTest): void {
    const name = [...recorder.describes, test.name].join(' > ');
    recorder.tests.push({ ...test, name });
}

/** Returns a case's test name, with `%s`, `%d`, `%#` and `$property` filled in, as Vitest fills them. */
function formatCaseName(options: { readonly name: string; readonly item: unknown; readonly index: number }): string {
    const { item, index } = options;
    const values = Array.isArray(item) ? item : [item];
    let next = 0;
    let name = options.name.replace(/%[sdifjo#%]/g, (token) => {
        if (token === '%%') return '%';
        if (token === '%#') return String(index);
        return String(values[next++]);
    });
    if (item instanceof Object && !Array.isArray(item)) {
        name = name.replace(/\$([\w.]+)/g, (_, path: string) => String(path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], item)));
    }
    return name;
}
