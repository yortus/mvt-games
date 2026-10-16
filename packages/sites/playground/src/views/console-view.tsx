/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import type { ConsoleEntry } from '../models';
import type { SourceLocation } from '../runtime';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ConsoleViewBindings {
    readonly entries: () => readonly ConsoleEntry[];
    /** Reported as an entry's place is pressed, to open its file there. */
    readonly onPlaceChosen?: (location: SourceLocation) => void;
    readonly onClearPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * What the project logged, and its errors, each with a link to the file and
 * line it came from, where that is known. It keeps the newest line in view.
 */
export function ConsoleView(bindings: ConsoleViewBindings): Element {
    const watcher = watch({ count: () => bindings.entries().length });

    return (
        <section class="console" aria-label="Console">
            <div class="console-head">
                <span class="console-title" text="Console" />
                <button type="button" class="console-clear" text="Clear" onClick={() => bindings.onClearPressed?.()} />
            </div>
            <ol class="console-lines" onRefresh={keepNewestInView}>
                <List items={bindings.entries}>
                    {(entry) => {
                        const placeLabel = createPlaceLabeller();
                        return (
                            <li class={() => LEVEL_CLASSES[entry().level]}>
                                <button
                                    type="button"
                                    class="console-place"
                                    visible={() => entry().location !== undefined}
                                    text={() => placeLabel(entry().location)}
                                    onClick={() => choosePlace(entry().location)}
                                />
                                <span class="console-text" text={() => entry().text} />
                            </li>
                        );
                    }}
                </List>
            </ol>
        </section>
    );

    function choosePlace(location: SourceLocation | undefined): void {
        if (location !== undefined) bindings.onPlaceChosen?.(location);
    }

    function keepNewestInView(lines: Element): void {
        if (watcher.poll().count.increased) lines.scrollTop = lines.scrollHeight;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Labels a place as `path:line`, building the label only when the place is a
 * different one, so a refresh does not build a new string every frame.
 */
function createPlaceLabeller(): (location: SourceLocation | undefined) => string {
    let labelled: SourceLocation | undefined;
    let label = '';
    return (location) => {
        if (location !== labelled) {
            labelled = location;
            label = location === undefined ? '' : `${location.path}:${location.line}`;
        }
        return label;
    };
}

const LEVEL_CLASSES: Readonly<Record<ConsoleEntry['level'], string>> = {
    log: 'console-line',
    info: 'console-line',
    warn: 'console-line console-warn',
    error: 'console-line console-error',
};
