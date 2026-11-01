/** @jsxImportSource @mvtjs/html */
import { PALETTES } from '../palettes';
import { PlayControlsView, PreviewView } from '../preview';
import { ReferenceView } from '../reference';
import type { EmbedModel } from './embed-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EmbedViewBindings {
    readonly model: EmbedModel;
    /** Where the editor goes, once the page has loaded it. It shows while the model is editing. */
    readonly editorPane: Element;
    /** Whether the bar shows the example's name, for a page that doesn't show it already. */
    readonly isNameShown: boolean;
    /** Whether the bar has Open in the playground, for a page that doesn't link to it already. */
    readonly isPlaygroundLinkShown: boolean;
    /** The address of a page of the book, by its path in the docs, for the cheat sheet's links. */
    readonly chapterUrlOf: (path: string) => string;
    readonly onOpenInPlaygroundPressed?: () => void;
    /** Reported with an import line, as a cheat sheet entry's Copy import is pressed. */
    readonly onCopyImportPressed?: (line: string) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * An example running in a page of the docs: the run, a bar of controls below
 * it, and, once the reader asks to edit, the editor below the bar, so the bar
 * sits between the run and the code. While editing, the bar also has Files,
 * a list of the example's files to choose the one shown, and the cheat sheet,
 * a drawer over the right of the run. The example's name, and a button that
 * opens it in the playground, show only if the page asks for them. A problem
 * that stops the run shows at the foot.
 */
export function EmbedView(bindings: EmbedViewBindings): Element {
    const { model } = bindings;
    let fileMenu: Element | undefined;
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return (
        <div
            class={() => (model.isEditing ? 'embed embed-editing' : 'embed')}
            onDestroyed={() => {
                document.removeEventListener('pointerdown', onPointerDown);
                document.removeEventListener('keydown', onKeyDown);
            }}
        >
            <div class="embed-run">
                <PreviewView
                    sandboxDocument={() => model.sandboxDocument}
                    sandboxesStarted={() => model.sandboxesStarted}
                    isPaused={() => model.isPaused}
                    steps={() => model.steps}
                    speed={() => model.speed}
                    background={() => PALETTES[model.theme].palette.background}
                    // This page keeps the focus, and passes keys on. A sandbox
                    // given the focus as it starts may lose it as its document
                    // loads, and then keys would reach neither page
                    isKeyboardForwarded
                    isFocusTaken={() => false}
                    placeholder={() => model.problem ?? 'Starting...'}
                    onSandboxMessage={(message) => {
                        if (message.kind === 'error') model.reportError(message.message);
                    }}
                />
                <div class={() => (model.isReferenceOpen ? 'embed-reference embed-reference-open' : 'embed-reference')}>
                    <ReferenceView
                        model={model.reference}
                        isOpen={() => model.isReferenceOpen}
                        chapterUrlOf={bindings.chapterUrlOf}
                        onCopyImportPressed={bindings.onCopyImportPressed}
                        onClosed={() => model.closeReference()}
                    />
                </div>
            </div>
            <div class="embed-bar">
                <span class="embed-name" text={model.name} visible={bindings.isNameShown} />
                <PlayControlsView
                    isPaused={() => model.isPaused}
                    speed={() => model.speed}
                    onStepPressed={() => model.step()}
                    onSpeedPressed={(speed) => model.playAt(speed)}
                />
                <button type="button" title="Run it again from the start" text="Restart" onClick={() => model.restart()} />
                <span class="embed-spacer" />
                <div class="embed-files" visible={() => model.isEditing} ref={(element) => (fileMenu = element)}>
                    <button
                        type="button"
                        class={() => (model.isFileMenuOpen ? 'embed-files-button embed-files-button-open' : 'embed-files-button')}
                        title="Choose the file to show"
                        text="Files"
                        aria-haspopup="menu"
                        aria-expanded={() => model.isFileMenuOpen}
                        onClick={() => model.toggleFileMenu()}
                    />
                    <div class="embed-file-menu" role="menu" visible={() => model.isFileMenuOpen}>
                        {model.files.map((file) => (
                            <button
                                type="button"
                                role="menuitemradio"
                                class={() => (model.activePath === file.path ? 'embed-file embed-file-active' : 'embed-file')}
                                text={file.path}
                                aria-checked={() => model.activePath === file.path}
                                onClick={() => model.showFile(file.path)}
                            />
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    class={() => (model.isReferenceOpen ? 'embed-reference-button embed-reference-button-open' : 'embed-reference-button')}
                    title="The APIs this example uses, and the rest"
                    text="Cheat sheet"
                    aria-pressed={() => model.isReferenceOpen}
                    visible={() => model.isEditing}
                    onClick={() => model.toggleReference()}
                />
                <button
                    type="button"
                    title="See the code, change it, and watch it run again"
                    text="View code"
                    visible={() => !model.isEditing}
                    onClick={() => model.startEditing()}
                />
                <button
                    type="button"
                    title="Open this example, with your changes, in the playground, in a new tab"
                    text="Open in the playground"
                    visible={bindings.isPlaygroundLinkShown}
                    onClick={() => bindings.onOpenInPlaygroundPressed?.()}
                />
            </div>
            <div class="embed-editor" visible={() => model.isEditing} ref={(element) => element.append(bindings.editorPane)} />
            <div class="embed-problem" text={() => model.problem ?? ''} visible={() => model.problem !== undefined} />
        </div>
    );

    /** Closes the list of files as the reader presses anywhere else. */
    function onPointerDown(event: PointerEvent): void {
        if (model.isFileMenuOpen && !(event.target instanceof Node && fileMenu?.contains(event.target))) model.closeFileMenu();
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && model.isFileMenuOpen) model.closeFileMenu();
    }
}
