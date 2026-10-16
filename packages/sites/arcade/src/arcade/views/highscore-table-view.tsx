/** @jsxImportSource @mvtjs/html */
import { type HighscoreRow, TABLE_SIZE } from '../../highscores';
import { memoiseLast } from '@mvtjs/utils';
import type { HighscoresStatus } from '../models';
import { formatRank } from './labels';
import { PixelTextView } from './pixel-text-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/** What the table view shows. */
export interface HighscoreTableViewBindings {
    /** The table, best first. */
    readonly rows: () => readonly HighscoreRow[];
    /** Whether the tables are here, on their way, or out of reach: the last two are said in the table's place. */
    readonly status: () => HighscoresStatus;
    /** The rank of a row to flash, 1 for the top: a score just entered. */
    readonly highlightRank?: () => number | undefined;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A game's highscore table, as a cabinet showed it: ten places, each a rank,
 * initials and a score in the arcade's pixel font, every place shown even
 * before anyone has taken it. The row just entered flashes, which is this
 * view's presentation state.
 */
export function HighscoreTableView(bindings: HighscoreTableViewBindings): Element {
    let flashMs = 0;
    const rows: Element[] = [];
    for (let index = 0; index < TABLE_SIZE; index++) rows.push(rowAt(index));

    return (
        <div class="hs-table" onUpdate={(deltaMs) => { flashMs += deltaMs; }}>
            <p class="hs-status" visible={() => bindings.status() !== 'ready'} text={statusText} />
            <ol class="hs-rows" visible={() => bindings.status() === 'ready'}>
                {rows}
            </ol>
        </div>
    );

    function rowAt(index: number): Element {
        const scoreText = memoiseLast((score: number | undefined) => (score === undefined ? '' : String(score)));
        const rank = formatRank(index + 1);
        return (
            <li class={() => rowClass(index)}>
                <span class="hs-rank">{PixelTextView({ text: rank, label: `${index + 1}.` })}</span>
                <span class="hs-initials">{PixelTextView({ text: () => bindings.rows()[index]?.initials ?? '' })}</span>
                <span class="hs-score">{PixelTextView({ text: () => scoreText(bindings.rows()[index]?.score) })}</span>
            </li>
        );
    }

    function rowClass(index: number): string {
        if (bindings.highlightRank?.() === index + 1) return flashMs % (2 * FLASH_MS) < FLASH_MS ? 'hs-row is-new is-lit' : 'hs-row is-new';
        return index < bindings.rows().length ? 'hs-row' : 'hs-row is-empty';
    }

    function statusText(): string {
        return bindings.status() === 'loading' ? 'Loading the highscores…' : 'The highscores are offline just now.';
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long the row just entered stays lit, then dim, as it flashes. */
const FLASH_MS = 250;
