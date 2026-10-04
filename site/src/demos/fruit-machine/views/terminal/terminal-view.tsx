/** @jsxImportSource @mvtjs/html */
import type { FruitMachineModel } from '../../models';
import { createTerminalViewModel } from './terminal-view-model';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TerminalViewBindings {
    readonly model: FruitMachineModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The machine as a text terminal. Type `spin` and press Enter; the reels turn
 * as text, and the result is printed. Its view model does the work; this
 * view is the screen and the keyboard.
 */
export function TerminalView(bindings: TerminalViewBindings): Element {
    const viewModel = createTerminalViewModel({ model: bindings.model });
    let screen: HTMLElement | undefined;
    let input: HTMLInputElement | undefined;
    let shownTranscript = '';

    return (
        <section class="terminal" aria-label="Terminal" onUpdate={viewModel.update} onClick={focusInput}>
            <div class="terminal-screen" ref={(el) => { screen = el; }}>
                <pre class="terminal-transcript" text={() => viewModel.transcript} onRefresh={scrollToEnd} />
                <pre class="terminal-live" visible={() => viewModel.liveText !== ''} text={() => viewModel.liveText} />
                <div class="terminal-prompt">
                    <span class="terminal-caret" text={() => (viewModel.isBusy ? '' : '>')} />
                    <input
                        class="terminal-input"
                        type="text"
                        aria-label="Command"
                        placeholder={() => (viewModel.isBusy ? 'spinning... Ctrl+C to stop' : 'type help, or spin')}
                        ref={(el) => {
                            input = el;
                            el.autocomplete = 'off';
                            el.spellcheck = false;
                        }}
                        onKeyDown={onKeyDown}
                    />
                </div>
            </div>
        </section>
    );

    /** Keeps the newest output in sight: scrolls to the end whenever the transcript grows. */
    function scrollToEnd(): void {
        const transcript = viewModel.transcript;
        if (transcript === shownTranscript || screen === undefined) return;
        shownTranscript = transcript;
        screen.scrollTop = screen.scrollHeight;
    }

    function onKeyDown(event: KeyboardEvent): void {
        const field = event.currentTarget as HTMLInputElement;
        if (event.key === 'Enter') {
            viewModel.submit(field.value);
            field.value = '';
        }
        else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            field.value = viewModel.recall(event.key === 'ArrowUp' ? -1 : 1);
        }
        else if (event.key === 'c' && event.ctrlKey && field.selectionStart === field.selectionEnd) {
            viewModel.interrupt();
            field.value = '';
        }
        else {
            return;
        }
        event.preventDefault();
    }

    /** A click anywhere on the terminal types into it, unless it was selecting text to copy. */
    function focusInput(): void {
        if (window.getSelection()?.isCollapsed !== false) input?.focus({ preventScroll: true });
    }
}
