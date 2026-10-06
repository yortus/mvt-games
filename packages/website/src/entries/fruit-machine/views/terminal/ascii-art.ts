import { type Paytable, PICTURE_KINDS, type SymbolKind } from '../../data';
import { SYMBOL_LABELS } from '../art';
import { formatCredits } from '../shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WindowBoxOptions {
    readonly reelCount: number;
    readonly rowCount: number;
    readonly symbolAt: (reel: number, row: number) => SymbolKind;
    /** Lit cells are drawn in brackets: `[CHERRY]`. */
    readonly isLitAt: (reel: number, row: number) => boolean;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * The window as a box of six-letter labels, one column per reel, in plain
 * ASCII: box-drawing characters fall back, on some devices, to a font that
 * draws them twice as wide as a letter.
 *
 *     +--------+--------+- ...
 *     | CHERRY |[*WILD*]|  ...
 */
export function drawWindowBox(options: WindowBoxOptions): string {
    const { reelCount, rowCount, symbolAt, isLitAt } = options;
    const lines = [edge(reelCount)];
    for (let row = 0; row < rowCount; row++) {
        let line = '|';
        for (let reel = 0; reel < reelCount; reel++) {
            const label = SYMBOL_LABELS[symbolAt(reel, row)];
            line += (isLitAt(reel, row) ? `[${label}]` : ` ${label} `) + '|';
        }
        lines.push(line);
    }
    lines.push(edge(reelCount));
    return lines.join('\n');
}

/** The terminal's greeting. */
export function drawBanner(): string {
    return [
        '+============================================+',
        '|   F R U I T   M A C H I N E     ~ 243 ~    |',
        '|   melon grapes cherry orange lemon berry   |',
        '+============================================+',
    ].join('\n');
}

/** The paytable as aligned text. */
export function drawPaytable(paytable: Paytable): string {
    const lines = ['Pays per way, for 3, 4 and 5 reels:', ''];
    for (const kind of PICTURE_KINDS) {
        const pays = paytable[kind];
        lines.push(`  ${SYMBOL_LABELS[kind]}  ${pad(pays[3])}  ${pad(pays[4])}  ${pad(pays[5])}`);
    }
    lines.push('', `  ${SYMBOL_LABELS.wild.trim()} stands in for any fruit on reels 2 to 5.`);
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A cell is a six-letter label with a space or bracket either side. */
const CELL = '--------';

function edge(reelCount: number): string {
    let line = '+';
    for (let reel = 0; reel < reelCount; reel++) line += `${CELL}+`;
    return line;
}

function pad(credits: number): string {
    return formatCredits(credits).padStart(4);
}
