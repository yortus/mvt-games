/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { createComputed } from '@mvtjs/utils';
import type { SymbolKind } from '../../data';
import type { WayWin } from '../../models';
import { formatCredits, formatRows, lastFor } from '../shared';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface WinsListViewBindings {
    /** Every winning way, highest payout first. */
    readonly wins: () => readonly WayWin[];
    /** The way being celebrated, if any. */
    readonly currentWin: () => WayWin | undefined;
    readonly totalWin: () => number;
    readonly urlFor: (kind: SymbolKind) => string;
    readonly nameFor: (kind: SymbolKind) => string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Every winning way, one per line, the one being celebrated highlighted. */
export function WinsListView(bindings: WinsListViewBindings): Element {
    const countText = createComputed({ watch: () => bindings.wins().length, compute: describeWayCount });
    const totalText = createComputed({ watch: bindings.totalWin, compute: (total) => `${formatCredits(total)} credits` });

    return (
        <div class="wins">
            <h3>
                <span text={countText} />
                <span class="wins-total" text={totalText} />
            </h3>
            <ol class="wins-list">
                <List items={bindings.wins}>
                    {(win) => winRow(bindings, win)}
                </List>
            </ol>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function describeWayCount(count: number): string {
    return count === 1 ? '1 way' : `${count} ways`;
}

/** One way's line of the list. */
function winRow(bindings: WinsListViewBindings, win: () => WayWin): Element {
    // A slot shows a different way after each spin, so its text follows the way it holds
    const rowsText = lastFor(formatRows);
    const lengthText = createComputed({ watch: () => win().rows.length, compute: (length) => `x${length}` });
    const payoutText = createComputed({ watch: () => win().payout, compute: (payout) => `+${formatCredits(payout)}` });

    return (
        <li class={() => (win() === bindings.currentWin() ? 'win current' : 'win')}>
            <img src={() => bindings.urlFor(win().symbol)} alt="" />
            <span class="win-name" text={() => bindings.nameFor(win().symbol)} />
            <span class="win-length" text={lengthText} />
            <span class="win-rows" text={() => rowsText(win().rows)} />
            <span class="win-payout" text={payoutText} />
        </li>
    );
}
