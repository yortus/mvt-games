/** @jsxImportSource @mvtjs/html/jsx */
import { memoiseLast } from '@mvtjs/utils';
import type { ReelPhase } from '../../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ReelsTableViewBindings {
    /** How many reels, and so rows in the table. */
    readonly reelCount: number;
    readonly phaseAt: (reel: number) => ReelPhase;
    readonly positionAt: (reel: number) => number;
    readonly stopIndexAt: (reel: number) => number;
    readonly progressAt: (reel: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Each reel's numbers, raw: the model's linear motion, before any view eases
 * it. Watch the settle column fill steadily while the other quadrants bounce,
 * and the position jump as each reel starts to settle.
 */
export function ReelsTableView(bindings: ReelsTableViewBindings): Element {
    const rows: Element[] = [];
    for (let reel = 0; reel < bindings.reelCount; reel++) rows.push(reelRow(bindings, reel));

    return (
        <table class="reels-table">
            <thead>
                <tr>
                    <th text="Reel" />
                    <th text="Phase" />
                    <th text="Position" />
                    <th text="Stop" />
                    <th text="Settle" />
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One reel's row of the table. */
function reelRow(bindings: ReelsTableViewBindings, reel: number): Element {
    // Text made only when what it shows changes: hundredths for the position
    const positionText = memoiseLast((hundredths: number) => (hundredths / 100).toFixed(2));
    const stopText = memoiseLast((stop: number) => String(stop));

    return (
        <tr class={() => PHASE_CLASSES[bindings.phaseAt(reel)]}>
            <td text={String(reel + 1)} />
            <td text={() => bindings.phaseAt(reel)} />
            <td class="number" text={() => positionText(Math.round(bindings.positionAt(reel) * 100))} />
            <td class="number" text={() => stopText(bindings.stopIndexAt(reel))} />
            <td>
                <progress max={1} value={() => bindings.progressAt(reel)} />
            </td>
        </tr>
    );
}

const PHASE_CLASSES: { readonly [P in ReelPhase]: string } = {
    stopped: 'reel-stopped',
    spinning: 'reel-spinning',
    settling: 'reel-settling',
};
