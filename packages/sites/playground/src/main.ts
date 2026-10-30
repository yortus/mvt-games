import { refreshView, updateView } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import { EXPORT_PACKAGES } from 'virtual:export-packages';
import { EXAMPLES, findExample, STARTERS } from './examples';
import { exportProject, zipExportedProject } from './export';
import { createLanguageClient } from './language';
import { createWorkspaceModel, type OpenedProject, type ProjectRequest, toUniqueProjectName, type WorkspaceModel } from './models';
import {
    buildSandboxDocument,
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
import {
    createMemoryProjectDatabase,
    loadSettings,
    openProjectDatabase,
    type ProjectDatabase,
    saveSettings,
    type StoredProject,
} from './storage';
import { HelpButtonView, PlaygroundView, THEME_CHOICES, ThemePickerView, THEMES } from './views';
import './nav.css';
import './playground.css';

// The playground's page. One loop runs it, in the MVT order: the workspace's
// model, then the page's views. The project itself runs in the preview's
// sandbox, which has a loop of its own.
//
// The page does what the model cannot: it makes each run's sandbox
// document, and checks the project as the model asks, which take awaiting.
// It keeps the visitor's projects in IndexedDB, saving the one open as it
// changes, and the workspace's settings in localStorage. It writes share
// links and exported projects, and keeps the URL naming the example open. It
// reads the project to open from the URL: an example, or a share link.
// Without one, it opens the project the
// visitor last worked on, or the first example. Whatever opens, runs. The
// sandbox's origin is opaque, so a shared project cannot reach anything the
// site keeps for the visitor.

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const libraryUrls = findLibraryUrls();
const settings = loadSettings();
const database = await openDatabase();
const first = await readFirstProject(database, settings.lastProjectId);
/** The kept project open last, which the settings keep. An example open leaves it as it was. */
let lastProjectId = first.project.id ?? settings.lastProjectId;
const model = createWorkspaceModel({
    project: first.project,
    savedLayout: settings.layout,
    isRunOnChange: settings.isRunOnChange,
    theme: settings.theme,
    createId: createProjectId,
});
if (first.exampleId !== undefined) model.openExample(first.exampleId);
void listKeptProjects(model);
const watcher = watch({
    runs: () => model.runsRequested,
    checks: () => model.checksRequested,
    shares: () => model.sharesRequested,
    copies: () => model.copiesRequested,
    saves: () => model.savesRequested,
    exports: () => model.exportsRequested,
    projectChanges: () => model.projectChanges,
    edits: () => model.edits,
    exampleId: () => model.exampleId,
});
const settingsWatcher = watch({
    projectId: () => model.projectId,
    isRunOnChange: () => model.isRunOnChange,
    theme: () => model.theme,
    filesWidth: () => model.layout.filesWidth,
    runWidth: () => model.layout.runWidth,
    consoleHeight: () => model.layout.consoleHeight,
    isFilesFolded: () => model.layout.isFilesFolded,
});

// The language service starts once the page has drawn, since loading
// TypeScript takes a while, and the editor works as plain text until it is ready
const language = createLanguageClient({ files: () => model.files, isBarrelKept: () => model.isBarrelKept });

const root = document.getElementById('playground');
if (root === null) throw new Error('The page has no #playground element');
root.append(PlaygroundView({ model, examples: EXAMPLES, starters: STARTERS, language }));
// The theme's menu, and the Help's (i) after the GitHub link, are in the
// site's nav, a second root, ticked as the first is
const nav = document.querySelector<HTMLElement>('.site-nav');
const navTools = document.getElementById('site-nav-tools');
const navEnd = document.getElementById('site-nav-end');
if (nav === null || navTools === null || navEnd === null) throw new Error('The page has no site nav with #site-nav-tools and #site-nav-end');
navTools.append(ThemePickerView({ themes: THEME_CHOICES, theme: () => model.theme, onThemeChosen: (theme) => model.setTheme(theme) }));
navEnd.append(HelpButtonView({
    isOpen: () => model.layout.isHelpOpen,
    // The nav is above the Help's backdrop, so the (i) closes the Help as well as opening it
    onPressed: () => (model.layout.isHelpOpen ? model.layout.closeHelp() : model.layout.openHelp()),
}));
model.run();
requestAnimationFrame(() => {
    language.start();
    void checkFirst(model);
});

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
    updateView(nav!, deltaMs);
    refreshView(root!);
    refreshView(nav!);
    requestAnimationFrame(frame);
}

/** Starts what the model asks the page for, and keeps the URL and the kept project in step with it. */
function followModel(workspace: WorkspaceModel): void {
    const { runs, checks, shares, copies, saves, exports, projectChanges, edits, exampleId } = watcher.poll();
    if (runs.increased) void prepareRun(workspace);
    if (checks.increased) {
        void checkAll(workspace);
    }
    if (shares.increased) void share(workspace);
    if (copies.increased) void copyShareLink(workspace);
    if (exports.increased) downloadExport(workspace);
    if (projectChanges.changed || saves.increased) saveKeptProject(workspace);
    if (workspace.projectRequests.length > 0) {
        for (const request of workspace.takeProjectRequests()) void handleProjectRequest(workspace, request);
    }
    if (edits.changed || exampleId.changed) {
        // An example is named in the URL. A project of the visitor's own is
        // not, since it is saved, and a link it came from would reopen the
        // project as it was.
        const hash = exampleId.current === undefined ? '' : toExampleHash(exampleId.current);
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

/** How often the first type check looks to see if the language service is ready. */
const LANGUAGE_WAIT_MS = 200;

/** The visitor's projects, in IndexedDB. Where the browser keeps nothing, they are kept in memory. */
async function openDatabase(): Promise<ProjectDatabase> {
    try {
        return await openProjectDatabase({ indexedDB });
    }
    catch {
        return createMemoryProjectDatabase();
    }
}

/**
 * The project to open first, and which example it is, if it is one: what
 * the URL names, or else the kept project open last, or else the one saved
 * last, or else the first example.
 */
async function readFirstProject(projects: ProjectDatabase, lastId: string | undefined): Promise<{ project: OpenedProject; exampleId?: string }> {
    const request = readHashRequest(location.hash);
    if (request.kind === 'example') {
        const example = findExample(request.id);
        if (example !== undefined) return { project: example, exampleId: example.id };
    }
    else if (request.kind === 'shared') {
        const shared = await decodeSharedProject(request.encoded);
        if (shared !== undefined) return { project: shared };
    }
    for (const id of [lastId, (await projects.list())[0]?.id]) {
        const kept = id === undefined ? undefined : await projects.load(id);
        if (kept !== undefined) return { project: { id: kept.id, name: kept.name, description: kept.description, files: kept.files, isBarrelKept: kept.isBarrelKept } };
    }
    return { project: EXAMPLES[0], exampleId: EXAMPLES[0].id };
}

/** Makes the project's sandbox document, and tells the model, unless a newer run has started meanwhile. */
async function prepareRun(workspace: WorkspaceModel): Promise<void> {
    const run = workspace.runsRequested;
    const prepared = await prepareProject({ files: workspace.files });
    const urls = await libraryUrls;
    if (workspace.runsRequested !== run) return;
    if (prepared.problems.length > 0) workspace.reportProblems(prepared.problems);
    else workspace.reportPrepared(toSandboxDocument(workspace, prepared, urls));
}

/** Checks the project's files, and tells the model what the check found. The model ignores a check the files have changed since. */
async function checkProject(workspace: WorkspaceModel): Promise<void> {
    const checkNumber = workspace.checksRequested;
    const prepared = await prepareProject({ files: workspace.files });
    const urls = await libraryUrls;
    workspace.reportChecked({
        checkNumber,
        problems: prepared.problems,
        sandboxDocument: prepared.problems.length > 0 ? undefined : toSandboxDocument(workspace, prepared, urls),
    });
}

/** Asks the language service for the project's type problems, once it is ready, and tells the model. */
/**
 * Checks the project as the model asks: first its barrels, where the
 * playground keeps them, then its files and their types. A barrel that
 * changes makes the model ask for a check again at once, so this one stops.
 */
async function checkAll(workspace: WorkspaceModel): Promise<void> {
    if (await writeKeptBarrels(workspace)) return;
    void checkProject(workspace);
    void checkTypes(workspace);
}

/** The first check, once the language service is ready: the barrels, then the types. The files were prepared as the project ran. */
async function checkFirst(workspace: WorkspaceModel): Promise<void> {
    await whenLanguageReady();
    if (await writeKeptBarrels(workspace)) return;
    void checkTypes(workspace);
}

/** Tells the model the barrels the language service would keep, where the playground keeps them. Returns whether any changed. */
async function writeKeptBarrels(workspace: WorkspaceModel): Promise<boolean> {
    if (!workspace.isBarrelKept || !language.isReady) return false;
    const checkNumber = workspace.checksRequested;
    const barrels = await language.keptBarrels();
    if (barrels === undefined || workspace.checksRequested !== checkNumber) return false;
    return workspace.reportKeptBarrels(barrels);
}

async function whenLanguageReady(): Promise<void> {
    while (!language.isReady) await new Promise((resolve) => setTimeout(resolve, LANGUAGE_WAIT_MS));
}

async function checkTypes(workspace: WorkspaceModel): Promise<void> {
    const checkNumber = workspace.checksRequested;
    await whenLanguageReady();
    const problems = await language.diagnostics();
    if (problems !== undefined) workspace.reportTypeProblems({ checkNumber, problems });
}

function toSandboxDocument(workspace: WorkspaceModel, prepared: PreparedProject, urls: LibraryUrls): string {
    return buildSandboxDocument({
        background: THEMES[workspace.theme].palette.background,
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
    if (w.projectId.current !== undefined) lastProjectId = w.projectId.current;
    if (!w.anyChanged) return;
    const { layout } = workspace;
    saveSettings({
        lastProjectId,
        isRunOnChange: workspace.isRunOnChange,
        theme: workspace.theme,
        layout: {
            filesWidth: layout.filesWidth,
            runWidth: layout.runWidth,
            consoleHeight: layout.consoleHeight,
            isFilesFolded: layout.isFilesFolded,
        },
    });
}

/** The project waiting to be saved, if any: the latest only, since it replaces any before it. */
let unsavedProject: StoredProject | undefined;
let isSaving = false;

/** Saves the kept project open, as it is now, then lists the kept projects again. One save runs at a time. */
function saveKeptProject(workspace: WorkspaceModel): void {
    if (workspace.projectId === undefined) return;
    unsavedProject = {
        id: workspace.projectId,
        name: workspace.projectName,
        description: workspace.projectDescription,
        files: workspace.files,
        savedAt: Date.now(),
        isBarrelKept: workspace.isBarrelKept,
    };
    if (isSaving) return;
    isSaving = true;
    void (async () => {
        try {
            while (unsavedProject !== undefined) {
                const project = unsavedProject;
                unsavedProject = undefined;
                await database.save(project);
            }
        }
        catch (error) {
            console.error('The project could not be saved', error);
        }
        isSaving = false;
        await listKeptProjects(workspace);
    })();
}

/** Tells the model the projects kept, as the database has them now. */
async function listKeptProjects(workspace: WorkspaceModel): Promise<void> {
    workspace.reportKeptProjects(await database.list(), database.isKept);
}

/** Opens, duplicates or deletes a kept project, as the visitor asked, then lists the kept projects again. */
async function handleProjectRequest(workspace: WorkspaceModel, request: ProjectRequest): Promise<void> {
    const project = request.kind === 'delete' ? undefined : await database.load(request.id);
    if (request.kind === 'open' && project !== undefined) {
        workspace.openProject({ id: project.id, name: project.name, description: project.description, files: project.files, isBarrelKept: project.isBarrelKept });
    }
    else if (request.kind === 'duplicate' && project !== undefined) {
        const names = (await database.list()).map((p) => p.name);
        await database.save({ ...project, id: createProjectId(), name: toUniqueProjectName(project.name, names), savedAt: Date.now() });
    }
    else if (request.kind === 'delete') {
        await database.remove(request.id);
    }
    await listKeptProjects(workspace);
}

/** Makes the project into a Vite project, and downloads it as a zip. */
function downloadExport(workspace: WorkspaceModel): void {
    const exported = exportProject({ name: workspace.projectName, description: workspace.projectDescription, files: workspace.files, packages: EXPORT_PACKAGES });
    const zip = zipExportedProject(exported);
    const url = URL.createObjectURL(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exported.folder}.zip`;
    link.click();
    // The download has the file by the time the next task runs
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A new kept project's id: random, and made where `crypto.randomUUID` is missing too, as on a page served without HTTPS. */
function createProjectId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Writes a share link for the project, and copies it. The link is this
 * page's, with the project in its hash. The page's own URL stays as it was:
 * the Share dialog shows the link, and a reload opens the kept project.
 */
async function share(workspace: WorkspaceModel): Promise<void> {
    const project = { name: workspace.projectName, description: workspace.projectDescription, files: workspace.files, isBarrelKept: workspace.isBarrelKept };
    let size = 0;
    for (const file of project.files) size += file.path.length + file.text.length;
    if (size > MAX_SHARED_CHARACTERS) {
        workspace.reportShared('too-large');
        return;
    }
    workspace.reportShareLink(`${location.origin}${location.pathname}${location.search}${toSharedHash(await encodeSharedProject(project))}`);
    await copyShareLink(workspace);
}

/** Copies the share link, and tells the model whether the browser let it. */
async function copyShareLink(workspace: WorkspaceModel): Promise<void> {
    const link = workspace.shareLink;
    if (link === undefined) return;
    try {
        await navigator.clipboard.writeText(link);
        workspace.reportShared('copied');
    }
    catch {
        workspace.reportShared('failed');
    }
}
