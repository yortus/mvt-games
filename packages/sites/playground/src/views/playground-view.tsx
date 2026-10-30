/** @jsxImportSource @mvtjs/html */
import { PerfmonView } from '@mvtjs/html';
import { createComputed, createReaction, watch } from '@mvtjs/utils';
import { LIBRARIES, LIBRARY_SUMMARIES } from '../../libraries';
import type { DefinitionTarget, LanguageClient, TypeProblem } from '../language';
import type { PanelKind, ThemeKind, WorkspaceModel } from '../models';
import type { RendererKind } from '../project-api';
import { MAIN_PATH } from '../runtime';
import { CodeEditorView } from './code-editor-view';
import { ConsoleView } from './console-view';
import { DialogView } from './dialog-view';
import { createDialogs } from './dialogs';
import { DividerView } from './divider-view';
import { FileListView } from './file-list-view';
import { HeaderView } from './header-view';
import { type HelpLibrary, HelpView } from './help-view';
import { PreviewView } from './preview-view';
import { ProblemsView } from './problems-view';
import { ProjectOptionsView } from './project-options-view';
import { ProjectsView } from './projects-view';
import { QuickOpenView } from './quick-open-view';
import { RunControlsView } from './run-controls-view';
import { ShareView } from './share-view';
import { THEMES, writePalette } from './themes';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PlaygroundViewBindings {
    readonly model: WorkspaceModel;
    /** The examples to offer, by id and name. */
    readonly examples: readonly { readonly id: string; readonly name: string }[];
    /** The starting projects New offers, one for each renderer. */
    readonly starters: readonly { readonly renderer: RendererKind; readonly name: string; readonly description: string }[];
    /** The language service, for the editor's completions, hover and the rest. */
    readonly language?: LanguageClient;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The playground: the header, then the project's files, the editor, and the
 * run, with its controls, its preview, and its console and Problems list.
 * Dividers between the panes resize them, and the file list folds away. A
 * narrow screen shows one panel at a time, chosen by tabs.
 *
 * Ctrl+Enter, or Cmd+Enter, runs the project from anywhere on the page,
 * Ctrl+P, or Cmd+P, opens a file by name, Ctrl+O, or Cmd+O, opens the
 * Projects dialog, and Ctrl+S, or Cmd+S, saves the project.
 */
export function PlaygroundView(bindings: PlaygroundViewBindings): Element {
    const { model } = bindings;
    const { layout } = model;
    let problemsByPath: Map<string, TypeProblem[]> | undefined;
    let filteredChecks = -1;
    const sizes = watch({
        filesWidth: () => layout.filesWidth,
        runWidth: () => layout.runWidth,
        consoleHeight: () => layout.consoleHeight,
    });
    const writeThemeWhenThemeChanges = createReaction({ watch: () => model.theme, react: writeTheme });
    writeTheme(model.theme);
    const keptBarrelNote = createComputed({ watch: () => model.activePath, compute: describeKeptBarrel });
    // The page's dialogs, in place of the browser's, so they take the theme
    const dialogs = createDialogs();
    window.addEventListener('keydown', onKeyDown);

    return (
        <div class={() => PANEL_CLASSES[layout.narrowPanel]} onRefresh={writeThemeWhenThemeChanges} onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            <HeaderView
                projectName={() => model.projectName}
                saves={() => model.savesRequested}
                onOptionsPressed={() => layout.openProjectOptions()}
                onProjectsPressed={() => layout.openProjects()}
                onSharePressed={() => model.share()}
                onExportPressed={() => model.exportProject()}
            />
            <nav class="panel-tabs" aria-label="Panels">
                {PANELS.map((panel) => (
                    <button
                        type="button"
                        class={() => (layout.narrowPanel === panel.kind ? 'panel-tab panel-tab-active' : 'panel-tab')}
                        text={panel.label}
                        onClick={() => layout.showPanel(panel.kind)}
                    />
                ))}
            </nav>
            <div class={() => (layout.isFilesFolded ? 'workspace workspace-files-folded' : 'workspace')} ref={writeAllSizes} onRefresh={writeSizes}>
                <FileListView
                    paths={() => model.paths}
                    activePath={() => model.activePath}
                    fixedPath={MAIN_PATH}
                    isFolded={() => layout.isFilesFolded}
                    foldedFolders={() => layout.foldedFolders}
                    problemCountOf={model.problemCountOf}
                    isKeptBarrel={model.isKeptBarrel}
                    onFoldToggled={() => layout.toggleFiles()}
                    onFolderToggled={(path) => layout.toggleFolder(path)}
                    onFileChosen={(path) => model.openFile(path)}
                    onAddPressed={addFile}
                    onMovePressed={movePath}
                    onRemovePressed={removeFile}
                />
                <DividerView orientation="vertical" label="Resize the file list" onDragged={(deltaPx) => layout.resizeFiles(deltaPx)} />
                <div class="editor-pane">
                    <div class="editor-banner" visible={isLibraryOpen}>
                        <span class="editor-banner-path" text={() => model.libraryFile?.path ?? ''} />
                        <span class="editor-banner-note" text="Read-only: a library's declarations" />
                    </div>
                    <div class="editor-banner" visible={() => model.isKeptBarrel(model.activePath)}>
                        <span class="editor-banner-note" text={keptBarrelNote} />
                        <button type="button" class="editor-banner-button" text="Manage files myself" onClick={() => void stopAutoBarrels()} />
                    </div>
                    {CodeEditorView({
                        activePath: () => model.activePath,
                        textOf: model.textOf,
                        isReadOnly: (path) => path === model.libraryFile?.path || model.isKeptBarrel(path),
                        projectsOpened: () => model.projectsOpened,
                        externalEdits: () => model.externalEdits,
                        shownPlace: () => model.shownPlace,
                        placesShown: () => model.placesShown,
                        typeChecks: () => model.typeChecks,
                        typeProblemsFor: typeProblemsFor,
                        theme: () => model.theme,
                        language: bindings.language,
                        onTextEdited: (path, text) => model.editFile(path, text),
                        onDefinitionFound: openDefinition,
                        onEditsWanted: (edits) => model.applyEdits(edits),
                        askNewName: (oldName) => dialogs.prompt({ title: 'Rename', message: `Rename ${oldName}, everywhere it is used, to:`, value: oldName, confirmLabel: 'Rename' }),
                        tell: (message) => void dialogs.tell({ title: 'Cannot rename', message }),
                    })}
                </div>
                <DividerView orientation="vertical" label="Resize the run" onDragged={(deltaPx) => layout.resizeRun(deltaPx)} />
                <div class="run-pane">
                    <RunControlsView
                        phase={() => model.phase}
                        isPaused={() => model.isPaused}
                        speed={() => model.speed}
                        isRunOnChange={() => model.isRunOnChange}
                        onRunPressed={() => model.run()}
                        onStopPressed={() => model.stop()}
                        onPausePressed={() => model.pause()}
                        onResumePressed={() => model.resume()}
                        onStepPressed={() => model.step()}
                        onSpeedChosen={(speed) => model.setSpeed(speed)}
                        onRunOnChangeToggled={(isOn) => model.setRunOnChange(isOn)}
                    />
                    {PreviewView({
                        sandboxDocument: () => model.sandboxDocument,
                        sandboxesStarted: () => model.sandboxesStarted,
                        isPaused: () => model.isPaused,
                        steps: () => model.steps,
                        speed: () => model.speed,
                        background: () => THEMES[model.theme].palette.background,
                        isFocusTaken: () => model.isRunByVisitor,
                        placeholder: () => (model.phase === 'preparing' ? 'Preparing...' : 'Press Run, or Ctrl+Enter, to run the project'),
                        onSandboxMessage: (message) => model.reportSandboxMessage(message),
                    })}
                    <DividerView orientation="horizontal" label="Resize the console" onDragged={(deltaPx) => layout.resizeConsole(deltaPx)} />
                    <div class="run-tabs">
                        <div class="run-tab-bar" role="tablist">
                            <button
                                type="button"
                                role="tab"
                                class={() => (layout.runPaneTab === 'console' ? 'run-tab run-tab-active' : 'run-tab')}
                                text="Console"
                                onClick={() => layout.showRunPaneTab('console')}
                            />
                            <button
                                type="button"
                                role="tab"
                                class={() => (layout.runPaneTab === 'problems' ? 'run-tab run-tab-active' : 'run-tab')}
                                text={() => PROBLEM_TAB_LABELS[Math.min(model.problemList.length, PROBLEM_TAB_LABELS.length - 1)]}
                                onClick={() => layout.showRunPaneTab('problems')}
                            />
                            <button
                                type="button"
                                role="tab"
                                class={() => (layout.runPaneTab === 'performance' ? 'run-tab run-tab-active' : 'run-tab')}
                                text="Performance"
                                title="How fast the project runs, and how much work each frame does"
                                onClick={() => layout.showRunPaneTab('performance')}
                            />
                            <button type="button" class="run-tab-clear" text="Clear" visible={() => layout.runPaneTab === 'console'} onClick={() => model.clearConsole()} />
                        </div>
                        <div class="run-tab-body" visible={() => layout.runPaneTab === 'console'}>
                            <ConsoleView entries={() => model.consoleEntries} onPlaceChosen={(location) => model.showPlace(location)} />
                        </div>
                        <div class="run-tab-body" visible={() => layout.runPaneTab === 'problems'}>
                            <ProblemsView problems={() => model.problemList} onPlaceChosen={(location) => model.showPlace(location)} />
                        </div>
                        <div class="run-tab-body run-performance" visible={() => layout.runPaneTab === 'performance'}>
                            <PerfmonView metrics={() => model.performance} />
                        </div>
                    </div>
                </div>
            </div>
            <QuickOpenView
                isOpen={() => layout.isQuickOpenOpen}
                query={() => layout.quickOpenQuery}
                matches={() => layout.quickOpenMatches}
                onQueryTyped={(query) => layout.setQuickOpenQuery(query)}
                onPathChosen={(path) => {
                    layout.closeQuickOpen();
                    model.openFile(path);
                }}
                onClosed={() => layout.closeQuickOpen()}
            />
            <ProjectsView
                isOpen={() => layout.isProjectsOpen}
                projects={() => model.keptProjects}
                openId={() => model.projectId}
                isKept={() => model.isKeepingProjects}
                starters={bindings.starters}
                examples={bindings.examples}
                onExampleChosen={(id) => {
                    layout.closeProjects();
                    model.openExample(id);
                }}
                onNewPressed={(renderer) => {
                    layout.closeProjects();
                    model.newProject(renderer);
                }}
                onOpenPressed={(id) => {
                    layout.closeProjects();
                    if (id !== model.projectId) model.requestProject({ kind: 'open', id });
                }}
                onDuplicatePressed={(id) => model.requestProject({ kind: 'duplicate', id })}
                onDeletePressed={deleteProject}
                onClosed={() => layout.closeProjects()}
            />
            <ShareView
                status={() => model.shareStatus}
                link={() => model.shareLink}
                onCopyPressed={() => model.copyShareLink()}
                onExportPressed={() => {
                    model.closeShare();
                    model.exportProject();
                }}
                onClosed={() => model.closeShare()}
            />
            <ProjectOptionsView
                isOpen={() => layout.isProjectOptionsOpen}
                name={() => model.projectName}
                description={() => model.projectDescription}
                isBarrelKept={() => model.isBarrelKept}
                onRenamePressed={(name) => model.renameProject(name)}
                onDescriptionTyped={(description) => model.setProjectDescription(description)}
                onBarrelKeptToggled={(isKept) => model.setBarrelKept(isKept)}
                onClosed={() => layout.closeProjectOptions()}
            />
            <HelpView isOpen={() => layout.isHelpOpen} libraries={HELP_LIBRARIES} onClosed={() => layout.closeHelp()} />
            <DialogView dialogs={dialogs} />
        </div>
    );

    function isLibraryOpen(): boolean {
        return model.libraryFile !== undefined && model.activePath === model.libraryFile.path;
    }

    /**
     * A file's type problems. The model's list is filtered here, and only when
     * it changes, so the editor's refresh builds no array.
     */
    function typeProblemsFor(path: string): readonly TypeProblem[] {
        if (problemsByPath === undefined || filteredChecks !== model.typeChecks) {
            filteredChecks = model.typeChecks;
            problemsByPath = new Map();
            for (const problem of model.typeProblems) {
                const list = problemsByPath.get(problem.path) ?? [];
                list.push(problem);
                problemsByPath.set(problem.path, list);
            }
        }
        return problemsByPath.get(path) ?? NO_PROBLEMS;
    }

    /** Opens a definition: a place in the project, or a library's declarations, read-only. */
    function openDefinition(target: DefinitionTarget): void {
        if (!target.isLibrary) {
            model.showPlace({ path: target.path, line: target.line, column: target.column });
            return;
        }
        void bindings.language?.libraryFileText(target.path).then((text) => {
            if (text !== undefined) model.openLibraryFile({ path: target.path, text, line: target.line, column: target.column });
        });
    }

    /**
     * Writes the theme's colours to the CSS, as it changes. They go on the
     * document's root, since the editor's menu opens in the page's body,
     * outside this view.
     */
    function writeTheme(theme: ThemeKind): void {
        writePalette(document.documentElement, THEMES[theme]);
    }

    /** Writes the panes' sizes to the CSS, as each changes. */
    function writeSizes(workspace: Element): void {
        const { filesWidth, runWidth, consoleHeight } = sizes.poll();
        const style = (workspace as HTMLElement).style;
        if (filesWidth.changed) style.setProperty('--files-width', `${filesWidth.current}px`);
        if (runWidth.changed) style.setProperty('--run-width', `${runWidth.current}px`);
        if (consoleHeight.changed) style.setProperty('--console-height', `${consoleHeight.current}px`);
    }

    /** Writes the panes' first sizes to the CSS, as the workspace is made. */
    function writeAllSizes(workspace: Element): void {
        const style = (workspace as HTMLElement).style;
        style.setProperty('--files-width', `${layout.filesWidth}px`);
        style.setProperty('--run-width', `${layout.runWidth}px`);
        style.setProperty('--console-height', `${layout.consoleHeight}px`);
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key === 'Enter') {
            event.preventDefault();
            model.run();
        }
        else if (event.key === 'p' || event.key === 'P') {
            event.preventDefault();
            layout.openQuickOpen(model.paths);
        }
        else if (event.key === 's' || event.key === 'S') {
            event.preventDefault();
            model.save();
        }
        else if (event.key === 'o' || event.key === 'O') {
            event.preventDefault();
            layout.openProjects();
        }
    }

    /** Adds a file, in a folder, or at the root for '', asking for its path, the folder's filled in. */
    async function addFile(folder: string): Promise<void> {
        const path = (await dialogs.prompt({
            title: 'New file',
            message: 'Its path, such as models/ship-model.ts. A folder in the path is made if it is new.',
            value: folder === '' ? '' : `${folder}/`,
            confirmLabel: 'Add',
            // After the folder, to type the file's name
            isValueChosen: false,
        }))?.trim();
        if (path === undefined || path === '') return;
        const problem = model.addFile(path);
        if (problem !== undefined) await dialogs.tell({ title: 'Cannot add the file', message: problem });
    }

    /** Moves a file or a folder to a path the visitor gives, with the language service's edits to the imports of what moves. */
    async function movePath(from: string): Promise<void> {
        const to = (await dialogs.prompt({ title: 'Move', message: `Move ${from}, and update its imports, to:`, value: from, confirmLabel: 'Move' }))?.trim();
        if (to === undefined || to === '' || to === from) return;
        const edits = await (bindings.language?.fileRenameEdits(from, to) ?? Promise.resolve([]));
        const problem = model.movePath(from, to, edits);
        if (problem !== undefined) await dialogs.tell({ title: 'Cannot move it', message: problem });
    }

    /** Stops auto-generating barrels, from a barrel's banner, once the visitor confirms what that means. */
    async function stopAutoBarrels(): Promise<void> {
        const isConfirmed = await dialogs.confirm({
            title: 'Manage files yourself?',
            message: 'No rule at all, and barrels are ordinary files: keep them, change them, or have none. Import however you like.',
            confirmLabel: 'Manage them myself',
        });
        if (isConfirmed) model.setBarrelKept(false);
    }

    async function deleteProject(id: string): Promise<void> {
        const project = model.keptProjects.find((p) => p.id === id);
        if (project === undefined) return;
        const isConfirmed = await dialogs.confirm({ title: `Delete ${project.name}?`, message: 'It cannot be brought back.', confirmLabel: 'Delete', isDangerous: true });
        if (isConfirmed) model.requestProject({ kind: 'delete', id });
    }

    async function removeFile(path: string): Promise<void> {
        const isConfirmed = await dialogs.confirm({ title: `Remove ${path}?`, message: 'It cannot be brought back.', confirmLabel: 'Remove', isDangerous: true });
        if (isConfirmed) model.removeFile(path);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const NO_PROBLEMS: readonly TypeProblem[] = [];

/** The banner over a barrel the playground writes itself, at `path`. */
function describeKeptBarrel(path: string): string {
    return `Auto-generated. Exports everything in ${path.slice(0, path.lastIndexOf('/'))}/.`;
}

/** The libraries the help names: those a project imports by hand. A view's JSX runtime comes from its pragma. */
const HELP_LIBRARIES: readonly HelpLibrary[] = LIBRARIES
    .filter((library) => !library.endsWith('/jsx-runtime'))
    .map((library) => ({ name: library, summary: LIBRARY_SUMMARIES[library] }));

/** The panels a narrow screen shows one at a time, in the order of their tabs. */
const PANELS: readonly { readonly kind: PanelKind; readonly label: string }[] = [
    { kind: 'files', label: 'Files' },
    { kind: 'code', label: 'Code' },
    { kind: 'run', label: 'Run' },
];

/** The page's class for each panel, which a narrow screen's CSS shows alone. */
const PANEL_CLASSES: Readonly<Record<PanelKind, string>> = {
    files: 'playground show-files',
    code: 'playground show-code',
    run: 'playground show-run',
};

/** The Problems tab's label for 0, 1, and so on up to 9 problems, then for more. Built once, so a refresh builds no strings. */
const PROBLEM_TAB_LABELS: readonly string[] = [
    'Problems',
    ...Array.from({ length: 9 }, (_, i) => `Problems (${i + 1})`),
    'Problems (10+)',
];
