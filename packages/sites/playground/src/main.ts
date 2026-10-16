import { refreshView, updateView } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import { EXAMPLES, findExample } from './examples';
import { createWorkspaceModel, type WorkspaceModel } from './models';
import {
    buildSandboxDocument,
    convertOldCode,
    decodeSharedProject,
    encodeSharedProject,
    findLibraryUrls,
    type LibraryUrls,
    MAIN_PATH,
    type PreparedProject,
    prepareProject,
    readHashRequest,
    toExampleHash,
    toModuleName,
    toSharedHash,
} from './runtime';
import { loadOldPlaygroundProject, loadSavedProject, loadSettings, saveProject, saveSettings, type SavedProject } from './storage';
import { PlaygroundView } from './views';
import './nav.css';
import './playground.css';

// The playground's page. One loop runs it, in the MVT order: the workspace's
// model, then the page's views. The project itself runs in the preview's
// sandbox, which has a loop of its own.
//
// The page does what the model cannot: it makes each run's sandbox
// document, and checks the project as the model asks, which take awaiting.
// It keeps the project and the workspace's settings between visits, writes
// share links, and keeps the URL naming the example open. It
// reads the project to open from the URL: an example, a share link, or a
// link from the old playground. Without one, it opens the project the
// visitor last worked on, or the first example. Whatever opens, runs. The
// sandbox's origin is opaque, so a shared project cannot reach anything the
// site keeps for the visitor.

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const libraryUrls = findLibraryUrls();
const first = await readFirstProject();
const settings = loadSettings();
const model = createWorkspaceModel({ project: first.project, savedLayout: settings.layout, isRunOnChange: settings.isRunOnChange });
if (first.exampleId !== undefined) model.openExample(first.exampleId);
const watcher = watch({
    runs: () => model.runsRequested,
    checks: () => model.checksRequested,
    shares: () => model.sharesRequested,
    edits: () => model.edits,
    exampleId: () => model.exampleId,
});
const settingsWatcher = watch({
    isRunOnChange: () => model.isRunOnChange,
    filesWidth: () => model.layout.filesWidth,
    runWidth: () => model.layout.runWidth,
    consoleHeight: () => model.layout.consoleHeight,
    isFilesFolded: () => model.layout.isFilesFolded,
});
watcher.poll();
settingsWatcher.poll();

const root = document.getElementById('playground');
if (root === null) throw new Error('The page has no #playground element');
root.append(PlaygroundView({ model, examples: EXAMPLES }));
model.run();

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

let lastTimeMs: number | undefined;
requestAnimationFrame(frame);

function frame(timeMs: number): void {
    const deltaMs = lastTimeMs === undefined ? 0 : Math.min(timeMs - lastTimeMs, MAX_STEP_MS);
    lastTimeMs = timeMs;
    model.update(deltaMs);
    followModel(model);
    saveChangedSettings(model);
    updateView(root!, deltaMs);
    refreshView(root!);
    requestAnimationFrame(frame);
}

/** Starts what the model asks the page for, and keeps the URL and the saved project in step with it. */
function followModel(workspace: WorkspaceModel): void {
    const { runs, checks, shares, edits, exampleId } = watcher.poll();
    if (runs.increased) void prepareRun(workspace);
    if (checks.increased) void checkProject(workspace);
    if (shares.increased) void share(workspace);
    if (edits.changed) saveProject({ name: workspace.projectName, files: workspace.files });
    if (edits.changed || exampleId.changed) {
        // An example is named in the URL. A project of the visitor's own is
        // not, since it is saved, and a link it came from would reopen the
        // project as it was.
        const hash = exampleId.value === undefined ? '' : toExampleHash(exampleId.value);
        history.replaceState(undefined, '', `${location.pathname}${location.search}${hash}`);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The longest step the loop takes, so a tab left in the background does not jump ahead. */
const MAX_STEP_MS = 100;

/** The largest project, in characters, that a share link holds. A link of about 90 KB, gzipped. */
const MAX_SHARED_CHARACTERS = 300_000;

/** How long Share shows how it went, before it says "Share" again. */
const SHARE_STATUS_MS = 2500;

/** The project to open first, and which example it is, if it is one. */
async function readFirstProject(): Promise<{ project: SavedProject; exampleId?: string }> {
    const request = readHashRequest(location.hash);
    if (request.kind === 'example') {
        const example = findExample(request.id);
        if (example !== undefined) return { project: example, exampleId: example.id };
    }
    else if (request.kind === 'shared') {
        const shared = await decodeSharedProject(request.encoded);
        if (shared !== undefined) return { project: shared };
    }
    else if (request.kind === 'old-code') {
        return { project: { name: 'Shared from the old playground', files: convertOldCode(request.code) } };
    }
    const saved = loadSavedProject();
    if (saved !== undefined) return { project: saved };
    const old = loadOldPlaygroundProject();
    if (old !== undefined) return { project: { name: 'My first project', files: convertOldCode(old) } };
    return { project: EXAMPLES[0], exampleId: EXAMPLES[0].id };
}

/** Makes the project's sandbox document, and tells the model, unless a newer run has started meanwhile. */
async function prepareRun(workspace: WorkspaceModel): Promise<void> {
    const run = workspace.runsRequested;
    const prepared = await prepareProject({ files: workspace.files });
    const urls = await libraryUrls;
    if (workspace.runsRequested !== run) return;
    if (prepared.problems.length > 0) workspace.reportProblems(prepared.problems);
    else workspace.reportPrepared(toSandboxDocument(prepared, urls));
}

/** Checks the project's files, and tells the model what the check found. The model ignores a check the files have changed since. */
async function checkProject(workspace: WorkspaceModel): Promise<void> {
    const checkNumber = workspace.checksRequested;
    const prepared = await prepareProject({ files: workspace.files });
    const urls = await libraryUrls;
    workspace.reportChecked({
        checkNumber,
        problems: prepared.problems,
        sandboxDocument: prepared.problems.length > 0 ? undefined : toSandboxDocument(prepared, urls),
    });
}

function toSandboxDocument(prepared: PreparedProject, urls: LibraryUrls): string {
    return buildSandboxDocument({
        modules: prepared.modules,
        loops: prepared.loops,
        libraries: urls.libraries,
        runnerUrl: urls.runnerUrl,
        toModuleName,
        mainPath: MAIN_PATH,
    });
}

/** Saves the workspace's settings as any of them changes. */
function saveChangedSettings(workspace: WorkspaceModel): void {
    const w = settingsWatcher.poll();
    if (!(w.isRunOnChange.changed || w.filesWidth.changed || w.runWidth.changed || w.consoleHeight.changed || w.isFilesFolded.changed)) return;
    const { layout } = workspace;
    saveSettings({
        isRunOnChange: workspace.isRunOnChange,
        layout: {
            filesWidth: layout.filesWidth,
            runWidth: layout.runWidth,
            consoleHeight: layout.consoleHeight,
            isFilesFolded: layout.isFilesFolded,
        },
    });
}

/** Writes a share link for the project, puts it in the URL, and copies it. */
async function share(workspace: WorkspaceModel): Promise<void> {
    const project = { name: workspace.projectName, files: workspace.files };
    let size = 0;
    for (const file of project.files) size += file.path.length + file.text.length;
    if (size > MAX_SHARED_CHARACTERS) {
        workspace.reportShared('too-large');
    }
    else {
        history.replaceState(undefined, '', `${location.pathname}${location.search}${toSharedHash(await encodeSharedProject(project))}`);
        try {
            await navigator.clipboard.writeText(location.href);
            workspace.reportShared('copied');
        }
        catch {
            workspace.reportShared('failed');
        }
    }
    setTimeout(() => workspace.reportShared('idle'), SHARE_STATUS_MS);
}
