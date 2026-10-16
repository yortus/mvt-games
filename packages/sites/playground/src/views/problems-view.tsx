/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import type { Problem, SourceLocation } from '../runtime';
import { createPlaceLabeller } from './place-label';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ProblemsViewBindings {
    readonly problems: () => readonly Problem[];
    /** Reported as a problem's place is pressed, to open its file there. */
    readonly onPlaceChosen?: (location: SourceLocation) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * What stops the project running: syntax errors, and imports of files or
 * packages that are not there. Each links to its file, at its line where
 * that is known. It says so when there are none.
 */
export function ProblemsView(bindings: ProblemsViewBindings): Element {
    return (
        <section class="problems" aria-label="Problems">
            <p class="problems-none" visible={() => bindings.problems().length === 0} text="No problems found." />
            <ol class="problems-lines">
                <List items={bindings.problems}>
                    {(problem) => {
                        const placeLabel = createPlaceLabeller();
                        return (
                            <li class="problem">
                                <button
                                    type="button"
                                    class="problem-place"
                                    text={() => placeLabel(problem())}
                                    onClick={() => bindings.onPlaceChosen?.({ path: problem().path, line: problem().line ?? 1 })}
                                />
                                <span class="problem-text" text={() => problem().message} />
                            </li>
                        );
                    }}
                </List>
            </ol>
        </section>
    );
}
