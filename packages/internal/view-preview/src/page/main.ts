// The preview page. It lists the package's visual test files, loads a file
// when you open it, and runs the test you pick, with a knob for each literal
// in its pose, and a control for each field of the tuning objects it imports.
// Once the pose is shown, it measures what each knob changes, and folds away
// the knobs that leave the picture the same. Saving a test file or a view reloads the page, which picks the
// same test again, and keeps the knobs you changed whose literals are still
// as they were.
import './preview.css';
import testFiles from 'virtual:view-preview/test-files';
import vsnapConfig from 'virtual:view-preview/vsnap-config';
import type { KnobValue } from '../shared';
import { callApi } from './call-api';
import { type KnobEffect, type KnobEffects, measureKnobEffects } from './knob-effects';
import { renderKnobPanel } from './knob-panel';
import { findPoseInfo, setActiveKnobs } from './knobs';
import { createPreviewStage } from './preview-stage';
import { createReferencePanel } from './reference-panel';
import { createSnapshotForm } from './snapshot-form';
import { renderTuningPanel } from './tuning-panel';
import { findTuning, listTuningReads, type RegisteredTuning } from './tunings';
import { type RecordedTest, startRecording, takeRecordedTests } from './vsnap-stand-in';

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

type TestFile = (typeof testFiles)[number];

document.body.innerHTML = `
<div class="vp">
    <aside class="vp-tests"><h2>Visual tests</h2></aside>
    <main class="vp-main">
        <header class="vp-bar">
            <div class="vp-heading"><strong class="vp-title">Pick a test</strong> <a class="vp-where"></a></div>
            <div class="vp-buttons">
                <button class="vp-play" title="Play or pause (Space)">Play</button>
                <button class="vp-step" title="Move on one frame (.)">Step</button>
                <select class="vp-speed" title="Speed">
                    <option value="0.25">0.25x</option><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option>
                </select>
                <button class="vp-repose" title="Run the pose again (R)">Re-pose</button>
                <button class="vp-snapshot" title="Add a test that poses the view with the knobs as they are">Snapshot</button>
                <select class="vp-zoom" title="Zoom">
                    <option value="fit" selected>Fit</option><option value="1">100%</option><option value="2">200%</option><option value="3">300%</option><option value="4">400%</option>
                </select>
                <span class="vp-time"></span>
                <span class="vp-size"></span>
            </div>
            <form class="vp-snapshot-form" hidden>
                <label>New test's name <input type="text" spellcheck="false"></label>
                <button type="submit">Add test</button>
                <button type="button" class="vp-snapshot-cancel">Cancel</button>
                <span class="vp-snapshot-message"></span>
            </form>
        </header>
        <div class="vp-viewport"></div>
        <pre class="vp-error" hidden></pre>
    </main>
    <aside class="vp-side">
        <p class="vp-effects-status vp-note"></p>
        <div class="vp-knobs"></div>
        <div class="vp-tuning"></div>
        <section class="vp-reference" hidden></section>
    </aside>
</div>`;

const select = <E extends Element>(selector: string): E => document.querySelector<E>(selector)!;
const elements = {
    tests: select<HTMLElement>('.vp-tests'),
    title: select<HTMLElement>('.vp-title'),
    where: select<HTMLAnchorElement>('.vp-where'),
    play: select<HTMLButtonElement>('.vp-play'),
    step: select<HTMLButtonElement>('.vp-step'),
    speed: select<HTMLSelectElement>('.vp-speed'),
    repose: select<HTMLButtonElement>('.vp-repose'),
    zoom: select<HTMLSelectElement>('.vp-zoom'),
    time: select<HTMLElement>('.vp-time'),
    size: select<HTMLElement>('.vp-size'),
    viewport: select<HTMLElement>('.vp-viewport'),
    error: select<HTMLElement>('.vp-error'),
    effectsStatus: select<HTMLElement>('.vp-effects-status'),
    knobs: select<HTMLElement>('.vp-knobs'),
    tuning: select<HTMLElement>('.vp-tuning'),
    snapshot: select<HTMLButtonElement>('.vp-snapshot'),
    snapshotForm: select<HTMLFormElement>('.vp-snapshot-form'),
    reference: select<HTMLElement>('.vp-reference'),
};

const stage = createPreviewStage({
    viewport: elements.viewport,
    config: vsnapConfig,
    onFrame: () => {
        const models = stage.modelCount();
        elements.time.textContent = `${(stage.elapsedMs() / 1000).toFixed(2)} s played, ${models} model${models === 1 ? '' : 's'}`;
        elements.size.textContent = stage.describeSize();
        elements.play.textContent = stage.isPlaying() ? 'Pause' : 'Play';
        noteLaterReads();
    },
});

const loaded = new Map<string, Promise<readonly RecordedTest[]>>();
const filledLists = new Map<string, Promise<HTMLUListElement>>();
const selection = {
    file: undefined as TestFile | undefined,
    test: undefined as RecordedTest | undefined,
    values: new Map<number, KnobValue>(),
    button: undefined as HTMLElement | undefined,
    /** Where the selected test's pose is, in its file. */
    source: undefined as { readonly path: string; readonly line: number; readonly column: number } | undefined,
};
const posing = { isRunning: false, isPending: false };
/** What each knob changes on the selected test's pose, once measured, and the measurement under way, if one is. */
const effects = {
    test: undefined as RecordedTest | undefined,
    result: undefined as KnobEffects | undefined,
    run: undefined as { isCancelled: boolean; done: Promise<void> } | undefined,
    /** How many fields the view has read since the pose that the pose itself didn't read, as last shown. */
    laterCount: 0,
};
const tuningLists = new Map<RecordedTest, Promise<readonly RegisteredTuning[]>>();
const referencePanel = createReferencePanel({ host: elements.reference });
const snapshotForm = createSnapshotForm({
    form: elements.snapshotForm,
    target: () => {
        const { file, test, values, source } = selection;
        if (file === undefined || test === undefined || source === undefined) return undefined;
        const takenNames = [...(elements.tests.querySelectorAll<HTMLButtonElement>(`details[data-path="${CSS.escape(file.path)}"] button`))].map((button) => button.dataset.name ?? '');
        return { file: source.path, fileKey: file.path, testName: test.name, pose: findPoseInfo(test.pose), values, takenNames };
    },
});
const loading = { last: Promise.resolve() as Promise<unknown> };

elements.play.addEventListener('click', () => stage.setPlaying(!stage.isPlaying()));
elements.step.addEventListener('click', () => stage.step());
elements.speed.addEventListener('change', () => stage.setSpeed(Number(elements.speed.value)));
elements.repose.addEventListener('click', () => void requestPose());
elements.snapshot.addEventListener('click', () => snapshotForm.open());
elements.zoom.addEventListener('change', () => stage.setZoom(elements.zoom.value === 'fit' ? 'fit' : Number(elements.zoom.value)));
addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === ' ') {
        stage.setPlaying(!stage.isPlaying());
        event.preventDefault();
    }
    else if (event.key === '.') stage.step();
    else if (event.key === 'r') void requestPose();
});
addEventListener('error', (event) => showError(event.error ?? event.message));
addEventListener('unhandledrejection', (event) => showError(event.reason));

// In VS Code's webview, the extension picks a test by sending the address
// it's at, and the link to the source asks the extension to open it
addEventListener('hashchange', () => void restoreSelection());
addEventListener('message', (event: MessageEvent<{ readonly type?: string; readonly hash?: string }>) => {
    if (event.data.type === 'view-preview:select' && event.data.hash !== undefined) location.hash = event.data.hash;
});
elements.where.addEventListener('click', (event) => {
    if (selection.source !== undefined && openSource(selection.source)) event.preventDefault();
});

renderFileList();
void restoreSelection();

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Lists the test files, grouped by the entry or folder they test. */
function renderFileList(): void {
    const groups = new Map<string, TestFile[]>();
    for (const file of testFiles) {
        const group = file.path.replace(/\/?visual-tests\/[^/]+$/, '').replace(/^entries\/?/, '').replaceAll('/views', '') || 'entries';
        groups.set(group, [...(groups.get(group) ?? []), file]);
    }
    for (const [group, files] of groups) {
        const section = document.createElement('section');
        section.append(Object.assign(document.createElement('h3'), { textContent: group }));
        for (const file of files) section.append(createFileItem(file));
        elements.tests.append(section);
    }
}

function createFileItem(file: TestFile): HTMLDetailsElement {
    const details = document.createElement('details');
    details.dataset.path = file.path;
    const summary = document.createElement('summary');
    summary.textContent = file.path.replace(/^.*\//, '').replace(/\.test\.tsx?$/, '');
    summary.title = file.path;
    details.append(summary);
    details.addEventListener('toggle', () => {
        if (details.open) void fillTestList(file, details);
    });
    return details;
}

/** Lists a file's tests under its name, once it has loaded, and returns the list. */
function fillTestList(file: TestFile, details: HTMLDetailsElement): Promise<HTMLUListElement> {
    let filled = filledLists.get(file.path);
    if (filled === undefined) {
        filled = loadFile(file).then((tests) => {
            const list = document.createElement('ul');
            for (const test of tests) {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.textContent = test.name;
                button.dataset.name = test.name;
                button.addEventListener('click', () => void selectTest({ file, test, button }));
                item.append(button);
                list.append(item);
            }
            if (tests.length === 0) list.append(Object.assign(document.createElement('li'), { textContent: 'The preview didn\'t find a test in this file.', className: 'vp-note' }));
            details.append(list);
            return list;
        });
        filledLists.set(file.path, filled);
    }
    return filled;
}

/**
 * Loads a test file, once, and returns the tests it declares. Files load one
 * at a time, since each records its tests as it loads. The load itself is
 * kept, not its result, because a module runs only on its first import. So
 * a second import while the first is under way wouldn't record any tests.
 */
function loadFile(file: TestFile): Promise<readonly RecordedTest[]> {
    const cached = loaded.get(file.path);
    if (cached !== undefined) return cached;
    const load = loading.last.then(async () => {
        startRecording();
        try {
            await import(/* @vite-ignore */ file.url);
        }
        catch (error) {
            showError(error);
        }
        return takeRecordedTests();
    });
    loading.last = load;
    loaded.set(file.path, load);
    return load;
}

async function selectTest(options: { readonly file: TestFile; readonly test: RecordedTest; readonly button: HTMLElement }): Promise<void> {
    const { file, test, button } = options;
    selection.button?.classList.remove('vp-selected');
    button.classList.add('vp-selected');
    Object.assign(selection, { file, test, button, values: restoreValues(file, test) });
    Object.assign(effects, { test, result: undefined, laterCount: 0 });
    elements.effectsStatus.textContent = '';
    history.replaceState(undefined, '', `#${encodeURIComponent(file.path)}::${encodeURIComponent(test.name)}`);
    const pose = findPoseInfo(test.pose);
    elements.title.textContent = test.name;
    const path = decodeURIComponent(file.url.replace(/^.*?@fs\//, ''));
    selection.source = { path, line: pose?.line ?? 1, column: pose?.column ?? 1 };
    button.scrollIntoView({ block: 'nearest' });
    elements.where.textContent = `${file.path}${pose === undefined ? '' : `:${pose.line}`}`;
    elements.where.href = `vscode://file/${path}${pose === undefined ? '' : `:${pose.line}:${pose.column}`}`;
    renderKnobs();
    void renderTuning();
    snapshotForm.close();
    referencePanel.show({ file: path, name: test.name });
    await requestPose();
}

function renderKnobs(): void {
    const { test, values } = selection;
    if (test === undefined) return;
    renderKnobPanel({
        host: elements.knobs,
        pose: findPoseInfo(test.pose),
        values,
        effectOf: (index) => (effects.test === test ? effects.result?.pose.get(index) : undefined),
        onChange: () => {
            saveValues();
            void requestPose();
        },
    });
}

/**
 * Shows the fields of the tuning objects a test imports. The server finds
 * them in Vite's module graph. A change while time stands still runs the
 * pose again, so the view shows the pose as the new value makes it. A change
 * while the view plays sets the value under the running models and views,
 * which read it the next time they use it.
 */
async function renderTuning(): Promise<void> {
    const { test, source } = selection;
    if (test === undefined || source === undefined) return;
    const tunings = await loadTunings({ testFile: source.path, test });
    if (selection.test !== test) return;
    renderTuningPanel({
        host: elements.tuning,
        tunings,
        effectOf: (key) => findTuningEffect({ test, key }),
        onChange: () => {
            if (!stage.isPlaying()) void requestPose();
        },
        openSource,
    });
}

/** Returns the tuning objects a test imports, once for each test. The server finds them in Vite's module graph. */
function loadTunings(options: { readonly testFile: string; readonly test: RecordedTest }): Promise<readonly RegisteredTuning[]> {
    const { testFile, test } = options;
    let list = tuningLists.get(test);
    if (list === undefined) {
        list = callApi<{ readonly ids: readonly string[] }>({ route: `tunings?file=${encodeURIComponent(testFile)}` }).then(
            (answer) => answer.ids.map((id) => findTuning(id)).filter((found): found is RegisteredTuning => found !== undefined),
            (error: unknown) => {
                showError(error);
                return [];
            },
        );
        tuningLists.set(test, list);
    }
    return list;
}

/** Returns what a tuning field does to a test's pose. A field the pose doesn't read, but the view has read since, is `later`. */
function findTuningEffect(options: { readonly test: RecordedTest; readonly key: string }): KnobEffect | undefined {
    const { test, key } = options;
    const result = effects.test === test ? effects.result : undefined;
    const effect = result?.tuning.get(key);
    if (effect?.kind === 'unread' && listTuningReads().has(key)) return { kind: 'later' };
    return effect;
}

/** Shows the tuning panel again when the view reads a field that its pose didn't, so the field moves up from the folded ones. */
function noteLaterReads(): void {
    const result = effects.result;
    if (result === undefined || effects.test !== selection.test) return;
    let count = 0;
    for (const key of listTuningReads()) {
        if (!result.poseReads.has(key)) count++;
    }
    if (count === effects.laterCount) return;
    effects.laterCount = count;
    void renderTuning();
}

/**
 * Measures what each knob changes on the selected test's pose, unless it's
 * measured already. The frames hold still while it runs, since it sets each
 * knob in turn. A pose that's requested meanwhile cancels it, and it starts
 * again once that pose is shown.
 */
function startEffects(): void {
    const { test, source, values } = selection;
    if (test === undefined || source === undefined || effects.run !== undefined) return;
    if (effects.test === test && effects.result !== undefined) return;
    const run = { isCancelled: false, done: Promise.resolve() };
    effects.run = run;
    stage.setSuspended(true);
    elements.effectsStatus.textContent = 'Checking which knobs change this pose...';
    run.done = (async () => {
        try {
            const tunings = await loadTunings({ testFile: source.path, test });
            const result = await measureKnobEffects({
                stage,
                test,
                pose: findPoseInfo(test.pose),
                poseValues: values,
                tunings,
                onProgress: (done, total) => {
                    elements.effectsStatus.textContent = `Checking which knobs change this pose: ${done} of ${total}`;
                },
                isCancelled: () => run.isCancelled || selection.test !== test,
            });
            if (result === undefined || selection.test !== test) return;
            Object.assign(effects, { test, result, laterCount: 0 });
            elements.effectsStatus.textContent = describeEffects(result);
            renderKnobs();
            await renderTuning();
        }
        catch (error) {
            showError(error);
        }
        finally {
            stage.setSuspended(false);
            effects.run = undefined;
        }
    })();
}

/** Cancels the measurement under way, if there is one, and waits until it has put every knob back. */
async function cancelEffects(): Promise<void> {
    const run = effects.run;
    if (run === undefined) return;
    run.isCancelled = true;
    await run.done;
}

/** Returns the line above the knobs that says what the measurement found. */
function describeEffects(result: KnobEffects): string {
    if (result.note !== undefined) return result.note;
    const all = [...result.pose.values(), ...result.tuning.values()];
    const count = (kind: KnobEffect['kind']): number => all.filter((effect) => effect.kind === kind).length;
    const folded = count('same') + count('unread');
    const unchecked = count('unchecked');
    if (all.length === 0) return '';
    return [
        `${count('changes')} of ${all.length} knobs change this pose.`,
        folded > 0 ? `The ${folded} that leave it the same are folded away at the bottom of each list.` : '',
        unchecked > 0 ? `The preview can't check ${unchecked === 1 ? 'one, such as text, so it\'s' : `${unchecked}, such as text, so they're`} shown too.` : '',
    ].filter((sentence) => sentence !== '').join(' ');
}

/** Asks VS Code to open a file at a place, when the page is in its webview. Returns whether it did. */
function openSource(where: { readonly path: string; readonly line: number; readonly column: number }): boolean {
    if (window.parent === window) return false;
    window.parent.postMessage({ type: 'view-preview:open-source', ...where }, '*');
    return true;
}

/** Runs the selected test's pose, with the knobs as they are. A change while a pose runs runs it again once it's done. */
async function requestPose(): Promise<void> {
    if (posing.isRunning) {
        posing.isPending = true;
        return;
    }
    posing.isRunning = true;
    try {
        await cancelEffects();
        do {
            posing.isPending = false;
            await showSelected();
        } while (posing.isPending);
    }
    finally {
        posing.isRunning = false;
    }
    startEffects();
}

async function showSelected(): Promise<void> {
    const { test, values } = selection;
    if (test === undefined) return;
    const pose = findPoseInfo(test.pose);
    setActiveKnobs(pose === undefined ? undefined : { poseId: pose.id, values });
    elements.error.hidden = true;
    try {
        await stage.show(test);
    }
    catch (error) {
        showError(error);
    }
}

function showError(error: unknown): void {
    elements.error.hidden = false;
    elements.error.textContent = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);
}

/**
 * Picks the test the page's address names, as it was before a reload, or as
 * the VS Code extension asks. The address is the file's path and the test's
 * name, `#<path>::<name>`, or the line its pose starts on, `#<path>::@<line>`.
 * A line picks the first test the pose there declares, since a pose in a loop
 * or written for `.each` declares several. With neither, the file opens.
 */
async function restoreSelection(): Promise<void> {
    const [path, wanted = ''] = location.hash.slice(1).split('::').map((part) => decodeURIComponent(part));
    const details = [...elements.tests.querySelectorAll('details')].find((element) => element.dataset.path === path);
    const file = testFiles.find((candidate) => candidate.path === path);
    if (details === undefined || file === undefined) return;
    details.open = true;
    details.scrollIntoView({ block: 'nearest' });
    const tests = await loadFile(file);
    const list = await fillTestList(file, details);
    const line = wanted.startsWith('@') ? Number(wanted.slice(1)) : undefined;
    const index = tests.findIndex((test) => (line === undefined ? test.name === wanted : findPoseInfo(test.pose)?.line === line));
    const button = list.querySelectorAll('button')[index];
    if (index >= 0 && button !== undefined) await selectTest({ file, test: tests[index], button });
}

/** The key the knobs you changed on a test are kept under, for the browser's tab. */
function storageKey(file: TestFile, test: RecordedTest): string {
    return `view-preview:${file.path}::${test.name}`;
}

function saveValues(): void {
    const { file, test, values } = selection;
    if (file === undefined || test === undefined) return;
    const pose = findPoseInfo(test.pose);
    const saved = [...values].map(([index, value]) => [index, pose?.knobs[index]?.value, value]);
    sessionStorage.setItem(storageKey(file, test), JSON.stringify(saved));
}

/** Returns the knobs you changed on a test before a reload, leaving out each one whose literal has changed in the file since. */
function restoreValues(file: TestFile, test: RecordedTest): Map<number, KnobValue> {
    const values = new Map<number, KnobValue>();
    const pose = findPoseInfo(test.pose);
    const saved = JSON.parse(sessionStorage.getItem(storageKey(file, test)) ?? '[]') as [number, KnobValue, KnobValue][];
    for (const [index, initial, value] of saved) {
        if (pose?.knobs[index]?.value === initial) values.set(index, value);
    }
    return values;
}
