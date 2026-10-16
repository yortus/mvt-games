/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import type { ListedProblem } from '../models';
import type { SourceLocation } from '../runtime';
import { createPlaceLabeller } from './place-label';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ProblemsViewBindings {
    readonly problems: () => readonly ListedProblem[];
    /** Reported as a problem's place is pressed, to open its file there. */
    readonly onPlaceChosen?: (location: SourceLocation) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The project's problems, each linked to its file, at its line where that is
 * known. Those that stop it running come first, such as a syntax error or a
 * missing file, marked so. Then come type errors and warnings, which never
 * stop it. It says so when there are none.
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
                            <li class={() => PROBLEM_CLASSES[problem().isBlocking ? 'blocking' : problem().severity]}>
                                <button
                                    type="button"
                                    class="problem-place"
                                    text={() => placeLabel(problem())}
                                    onClick={() => bindings.onPlaceChosen?.({ path: problem().path, line: problem().line ?? 1, column: problem().column })}
                                />
                                <span class="problem-blocking" visible={() => problem().isBlocking} text="Stops the run" />
                                <span class="problem-text" text={() => problem().message} />
                            </li>
                        );
                    }}
                </List>
            </ol>
        </section>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const PROBLEM_CLASSES: Readonly<Record<'blocking' | 'error' | 'warning', string>> = {
    blocking: 'problem problem-error',
    error: 'problem problem-error',
    warning: 'problem problem-warning',
};
