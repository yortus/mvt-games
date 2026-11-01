import { PASSAGE, UNKNOWN, WALL } from './edge-states';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A line's clue as a pattern its edges must follow, as in a nonogram:
 * stretches of wall of the clue's lengths, in order, with at least one
 * passage between each two. It answers whether the edges known so far fit,
 * and what they force on the edges not yet known.
 *
 * The pattern is a chain of steps, read along the line an edge at a time: a
 * gap, which takes any number of passages, then a stretch's walls, one step
 * each, then another gap, and so on. A stretch's last wall must be followed
 * by a passage, or by the line's end. The work is done in arrays made once,
 * so a solver can ask again and again without making garbage.
 */
export interface LinePattern {
    /** Whether the `states` of the line's `edges` can still be made to fit the clue. */
    readonly fits: (states: Readonly<Uint8Array>, edges: Readonly<Int32Array>) => boolean;
    /**
     * Sets each unknown edge that every fit agrees on to a wall or a passage.
     * Returns how many it set, or -1 if nothing fits.
     */
    readonly narrow: (states: Uint8Array, edges: Readonly<Int32Array>) => number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LinePatternOptions {
    /** The lengths of the line's stretches of wall, in order. */
    readonly clue: readonly number[];
    /** How many edges the line has. */
    readonly length: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the pattern of a line of `length` edges with `clue`. */
export function createLinePattern(options: LinePatternOptions): LinePattern {
    const { clue, length } = options;
    // The steps: where each leads on a passage, and on a wall, or -1 where it can't take one
    const onPassage: number[] = [];
    const onWall: number[] = [];
    // The first gap, before any wall
    onPassage.push(0);
    onWall.push(clue.length > 0 ? 1 : -1);
    for (let run = 0; run < clue.length; run++) {
        for (let i = 0; i < clue[run]; i++) {
            const step = onPassage.length;
            const isLastWall = i === clue[run] - 1;
            onPassage.push(isLastWall ? step + 1 : -1);
            onWall.push(isLastWall ? -1 : step + 1);
        }
        // The gap after the stretch, entered by a passage
        const gap = onPassage.length;
        onPassage.push(gap);
        onWall.push(run < clue.length - 1 ? gap + 1 : -1);
    }
    const stepCount = onPassage.length;
    // The line may end in the last gap, or right after the last stretch's last wall
    const isFinal = new Uint8Array(stepCount);
    isFinal[stepCount - 1] = 1;
    if (clue.length > 0) isFinal[stepCount - 2] = 1;

    // Which steps can be reached after each edge, reading forwards, and which can still reach the end, reading back
    const reached = new Uint8Array((length + 1) * stepCount);
    const ending = new Uint8Array((length + 1) * stepCount);
    const canBeWall = new Uint8Array(length);
    const canBePassage = new Uint8Array(length);

    return {
        fits(states, edges) {
            readForwards(states, edges);
            for (let step = 0; step < stepCount; step++) {
                if (reached[length * stepCount + step] === 1 && isFinal[step] === 1) return true;
            }
            return false;
        },
        narrow(states, edges) {
            readForwards(states, edges);
            readBackwards(states, edges);
            canBeWall.fill(0);
            canBePassage.fill(0);
            for (let i = 0; i < length; i++) {
                const state = states[edges[i]];
                for (let step = 0; step < stepCount; step++) {
                    if (reached[i * stepCount + step] === 0) continue;
                    const next = (i + 1) * stepCount;
                    if (state !== WALL && onPassage[step] >= 0 && ending[next + onPassage[step]] === 1) canBePassage[i] = 1;
                    if (state !== PASSAGE && onWall[step] >= 0 && ending[next + onWall[step]] === 1) canBeWall[i] = 1;
                }
            }
            let changed = 0;
            for (let i = 0; i < length; i++) {
                if (canBeWall[i] === 0 && canBePassage[i] === 0) return -1;
                if (states[edges[i]] !== UNKNOWN) continue;
                if (canBeWall[i] === 0) {
                    states[edges[i]] = PASSAGE;
                    changed++;
                }
                else if (canBePassage[i] === 0) {
                    states[edges[i]] = WALL;
                    changed++;
                }
            }
            return changed;
        },
    };

    function readForwards(states: Readonly<Uint8Array>, edges: Readonly<Int32Array>): void {
        reached.fill(0);
        reached[0] = 1;
        for (let i = 0; i < length; i++) {
            const state = states[edges[i]];
            for (let step = 0; step < stepCount; step++) {
                if (reached[i * stepCount + step] === 0) continue;
                const next = (i + 1) * stepCount;
                if (state !== WALL && onPassage[step] >= 0) reached[next + onPassage[step]] = 1;
                if (state !== PASSAGE && onWall[step] >= 0) reached[next + onWall[step]] = 1;
            }
        }
    }

    function readBackwards(states: Readonly<Uint8Array>, edges: Readonly<Int32Array>): void {
        ending.fill(0);
        for (let step = 0; step < stepCount; step++) ending[length * stepCount + step] = isFinal[step];
        for (let i = length - 1; i >= 0; i--) {
            const state = states[edges[i]];
            for (let step = 0; step < stepCount; step++) {
                const next = (i + 1) * stepCount;
                const byPassage = state !== WALL && onPassage[step] >= 0 && ending[next + onPassage[step]] === 1;
                const byWall = state !== PASSAGE && onWall[step] >= 0 && ending[next + onWall[step]] === 1;
                if (byPassage || byWall) ending[i * stepCount + step] = 1;
            }
        }
    }
}
