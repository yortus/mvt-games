/** @jsxImportSource @mvtjs/html */
import type { ShareStatus, WorkspaceModel } from '../models';
import { MAIN_PATH } from '../runtime';
import { CodeEditorView } from './code-editor-view';
import { ConsoleView } from './console-view';
import { FileListView } from './file-list-view';
import { HeaderView } from './header-view';
import { PreviewView } from './preview-view';
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
 * The playground: the header, the project's files, the editor, and the run
 * with its controls, its preview and its console. Ctrl+Enter, or Cmd+Enter,
 * runs the project from anywhere on the page.
 */
export function PlaygroundView(bindings: PlaygroundViewBindings): Element {
    const { model } = bindings;
    window.addEventListener('keydown', onKeyDown);

    return (
        <div class="playground" onDestroyed={() => window.removeEventListener('keydown', onKeyDown)}>
            <HeaderView
                projectName={() => model.projectName}
                examples={bindings.examples}
                shareLabel={() => SHARE_LABELS[model.shareStatus]}
                isSharing={() => model.shareStatus === 'sharing'}
                onExampleChosen={(id) => model.openExample(id)}
                onSharePressed={() => model.share()}
            />
            <div class="workspace">
                <FileListView
                    paths={() => model.paths}
                    activePath={() => model.activePath}
                    fixedPath={MAIN_PATH}
                    onFileChosen={(path) => model.openFile(path)}
                    onAddPressed={addFile}
                    onRemovePressed={removeFile}
                />
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
                <div class="run-pane">
                    <RunControlsView
                        phase={() => model.phase}
                        isPaused={() => model.isPaused}
                        speed={() => model.speed}
                        onRunPressed={() => model.run()}
                        onStopPressed={() => model.stop()}
                        onPausePressed={() => model.pause()}
                        onResumePressed={() => model.resume()}
                        onStepPressed={() => model.step()}
                        onSpeedChosen={(speed) => model.setSpeed(speed)}
                    />
                    {PreviewView({
                        sandboxDocument: () => model.sandboxDocument,
                        sandboxesStarted: () => model.sandboxesStarted,
                        isPaused: () => model.isPaused,
                        steps: () => model.steps,
                        speed: () => model.speed,
                        placeholder: () => (model.phase === 'preparing' ? 'Preparing...' : 'Press Run, or Ctrl+Enter, to run the project'),
                        onSandboxMessage: (message) => model.reportSandboxMessage(message),
                    })}
                    <ConsoleView
                        entries={() => model.consoleEntries}
                        onPlaceChosen={(location) => model.showPlace(location)}
                        onClearPressed={() => model.clearConsole()}
                    />
                </div>
            </div>
        </div>
    );

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        model.run();
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
