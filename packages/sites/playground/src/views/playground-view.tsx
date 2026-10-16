/** @jsxImportSource @mvtjs/html */
import { watch } from '@mvtjs/utils';
import type { PanelKind, ShareStatus, WorkspaceModel } from '../models';
import { MAIN_PATH } from '../runtime';
import { CodeEditorView } from './code-editor-view';
import { ConsoleView } from './console-view';
import { DividerView } from './divider-view';
import { FileListView } from './file-list-view';
import { HeaderView } from './header-view';
import { PreviewView } from './preview-view';
import { ProblemsView } from './problems-view';
import { QuickOpenView } from './quick-open-view';
import { RunControlsView } from './run-controls-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PlaygroundViewBindings {
    readonly model: WorkspaceModel;
    /** The examples to offer, by id and name. */
    readonly examples: readonly { readonly id: string; readonly name: string }[];
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
 * Ctrl+Enter, or Cmd+Enter, runs the project from anywhere on the page, and
 * Ctrl+P, or Cmd+P, opens a file by name.
 */
export function PlaygroundView(bindings: PlaygroundViewBindings): Element {
    const { model } = bindings;
    const { layout } = model;
    const sizes = watch({
        filesWidth: () => layout.filesWidth,
        runWidth: () => layout.runWidth,
        consoleHeight: () => layout.consoleHeight,
    });
    window.addEventListener('keydown', onKeyDown);

    return (
        <div class={() => PANEL_CLASSES[layout.narrowPanel]} onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            <HeaderView
                projectName={() => model.projectName}
                examples={bindings.examples}
                shareLabel={() => SHARE_LABELS[model.shareStatus]}
                isSharing={() => model.shareStatus === 'sharing'}
                onExampleChosen={(id) => model.openExample(id)}
                onSharePressed={() => model.share()}
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
            <div class={() => (layout.isFilesFolded ? 'workspace workspace-files-folded' : 'workspace')} onRefresh={writeSizes}>
                <FileListView
                    paths={() => model.paths}
                    activePath={() => model.activePath}
                    fixedPath={MAIN_PATH}
                    isFolded={() => layout.isFilesFolded}
                    onFoldToggled={() => layout.toggleFiles()}
                    onFileChosen={(path) => model.openFile(path)}
                    onAddPressed={addFile}
                    onRemovePressed={removeFile}
                />
                <DividerView orientation="vertical" label="Resize the file list" onDragged={(deltaPx) => layout.resizeFiles(deltaPx)} />
                <div class="editor-pane">
                    {CodeEditorView({
                        activePath: () => model.activePath,
                        textOf: model.textOf,
                        projectsOpened: () => model.projectsOpened,
                        shownPlace: () => model.shownPlace,
                        placesShown: () => model.placesShown,
                        onTextEdited: (path, text) => model.editFile(path, text),
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
                                text={() => PROBLEM_TAB_LABELS[Math.min(model.problems.length, PROBLEM_TAB_LABELS.length - 1)]}
                                onClick={() => layout.showRunPaneTab('problems')}
                            />
                            <button type="button" class="run-tab-clear" text="Clear" visible={() => layout.runPaneTab === 'console'} onClick={() => model.clearConsole()} />
                        </div>
                        <div class="run-tab-body" visible={() => layout.runPaneTab === 'console'}>
                            <ConsoleView entries={() => model.consoleEntries} onPlaceChosen={(location) => model.showPlace(location)} />
                        </div>
                        <div class="run-tab-body" visible={() => layout.runPaneTab === 'problems'}>
                            <ProblemsView problems={() => model.problems} onPlaceChosen={(location) => model.showPlace(location)} />
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
        </div>
    );

    /** Writes the panes' sizes to the CSS, as each changes. */
    function writeSizes(workspace: Element): void {
        const { filesWidth, runWidth, consoleHeight } = sizes.poll();
        const style = (workspace as HTMLElement).style;
        if (filesWidth.changed) style.setProperty('--files-width', `${filesWidth.value}px`);
        if (runWidth.changed) style.setProperty('--run-width', `${runWidth.value}px`);
        if (consoleHeight.changed) style.setProperty('--console-height', `${consoleHeight.value}px`);
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
    }

    function addFile(): void {
        const path = window.prompt('The new file\'s path, such as models/ship-model.ts');
        if (path === null || path.trim() === '') return;
        const problem = model.addFile(path.trim());
        if (problem !== undefined) window.alert(problem);
    }

    function removeFile(path: string): void {
        if (window.confirm(`Remove ${path}? This cannot be undone.`)) model.removeFile(path);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHARE_LABELS: Readonly<Record<ShareStatus, string>> = {
    'idle': 'Share',
    'sharing': 'Sharing...',
    'copied': 'Link copied',
    'too-large': 'Too large to share',
    'failed': 'Could not copy',
};

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
