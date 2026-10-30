import { assert } from '../assert';
import type { CheckedReactionGetters } from './error-checks';
import { createWatched, rereadWatched, type Getter, type MutableWatched } from './watched';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a reaction: a function to call on every step, which runs `react`
 * for each change that `when` accepts. An array of getters reacts to each
 * one separately, and passes its index.
 */
export function createReaction<const W extends Getter | readonly Getter[]>(options: {
    readonly watch: W & CheckedReactionGetters<W>;
    /** A value, meaning "changed to it", or a condition. Leave it out to react to every change. */
    readonly when?: NoInfer<ValueIn<W>> | Condition<NoInfer<ValueIn<W>>, IndexIn<W>>;
    readonly react: (current: ValueIn<W>, previous: ValueIn<W>, ...index: IndexIn<W>) => void;
}): () => void {
    const { watch } = options;
    const hasWhen = 'when' in options;
    const when: unknown = options.when;
    const react = options.react as (current: unknown, previous: unknown, index?: number) => void;
    assert(
        !hasWhen || when !== undefined,
        'createReaction was given `when: undefined`, which is unclear. Leave `when` out to react to every change, '
        + 'or write `when: (current) => current === undefined` to react to a change to undefined.',
    );

    if (typeof watch === 'function') {
        const watched = createWatched({ getter: watch, name: 'createReaction: watch', isWatcher: false });
        return () => {
            if (!rereadWatched(watched)) return;
            if (!hasWhen || matchesWhen(when, watched.current, watched.previous, undefined)) {
                react(watched.current, watched.previous);
            }
        };
    }

    assert(
        Array.isArray(watch),
        'createReaction watches one getter, or an array of getters. '
        + 'To react to several values together, compute one value from them with createComputed, and react to that.',
    );
    const watched: MutableWatched[] = [];
    for (let i = 0; i < watch.length; i++) {
        watched.push(createWatched({ getter: watch[i] as Getter, name: `createReaction: watch[${i}]`, isWatcher: false }));
    }
    return () => {
        for (let i = 0; i < watched.length; i++) {
            const w = watched[i];
            if (!rereadWatched(w)) continue;
            if (!hasWhen || matchesWhen(when, w.current, w.previous, i)) {
                react(w.current, w.previous, i);
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type ValueIn<W> = W extends readonly (() => infer T)[] ? T : W extends () => infer T ? T : never;

/** Only an array's getters have an index. */
type IndexIn<W> = W extends readonly unknown[] ? [index: number] : [];

type Condition<T, I extends readonly unknown[]> = (current: T, previous: T, ...index: I) => boolean;

function matchesWhen(when: unknown, current: unknown, previous: unknown, index: number | undefined): boolean {
    // A watched value is never a function, so a function is always a condition
    if (typeof when !== 'function') return current === when;
    return (when as Condition<unknown, [number | undefined]>)(current, previous, index);
}
