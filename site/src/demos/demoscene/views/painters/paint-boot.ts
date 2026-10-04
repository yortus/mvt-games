import {
    BLACK, BLOCK_CHAR, BLUE, BOOT_BANNER, BOOT_COMMAND, BOOT_FOUND, BOOT_KEYS, BOOT_LOADING, BOOT_SEARCHING,
    CYAN, LIGHT_BLUE, LIGHT_RED, RED, WHITE, YELLOW,
} from '../../data';
import { type BootModel, hash01 } from '../../models';
import { COLUMNS, FRAME_HEIGHT, type VirtualChip } from '../chip';
import { writeText } from './paint-helpers';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Part 0. Light blue on blue, typing at the prompt; then, while loading,
 * the screen blanks and the border fills the frame with stripes that change
 * every 50 Hz frame, as a tape loader's did.
 */
export function paintBoot(chip: VirtualChip, boot: BootModel): void {
    const phase = boot.phase;
    if (phase === 'blank') return;
    if (phase === 'loading') {
        paintLoadingStripes(chip, boot.loadingFrame);
        return;
    }

    chip.border.fill(LIGHT_BLUE);
    chip.background.fill(BLUE);
    for (let row = 0; row < BOOT_BANNER.length; row++) writeText(chip, row, 0, BOOT_BANNER[row], LIGHT_BLUE);
    const promptRow = BOOT_BANNER.length;
    const typed = boot.typedCount;
    writeText(chip, promptRow, 0, BOOT_COMMAND, LIGHT_BLUE, typed);

    let cursorRow = promptRow;
    let cursorCol = typed;
    if (phase === 'searching' || phase === 'found') {
        writeText(chip, promptRow + 2, 0, BOOT_SEARCHING, LIGHT_BLUE);
        cursorRow = promptRow + 3;
        cursorCol = 0;
    }
    if (phase === 'found') {
        writeText(chip, promptRow + 3, 0, BOOT_FOUND, LIGHT_BLUE);
        writeText(chip, promptRow + 4, 0, BOOT_LOADING, LIGHT_BLUE);
        cursorRow = promptRow + 5;
    }
    if (boot.isCursorOn) {
        chip.screen[cursorRow * COLUMNS + cursorCol] = BLOCK_CHAR;
        chip.colour[cursorRow * COLUMNS + cursorCol] = LIGHT_BLUE;
    }
    writeText(chip, 24, 0, BOOT_KEYS, CYAN);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The stripes' colour pairs; the loader changes pair every second. */
const STRIPE_COLOURS: readonly number[] = [LIGHT_BLUE, YELLOW, RED, CYAN, WHITE, BLUE, LIGHT_RED, BLACK];

function paintLoadingStripes(chip: VirtualChip, frame: number): void {
    // A blanked screen: every line is border, the whole frame wide
    chip.sourceLine.fill(-1);
    const pair = (Math.floor(frame / 50) % (STRIPE_COLOURS.length / 2)) * 2;
    let line = 0;
    let stripe = 0;
    while (line < FRAME_HEIGHT) {
        // Random-looking heights, but the same for the same frame, so a paused frame stands still
        const height = 1 + Math.floor(hash01(frame, stripe) * 9);
        const colour = STRIPE_COLOURS[pair + (stripe & 1)];
        const end = Math.min(FRAME_HEIGHT, line + height);
        chip.border.fill(colour, line, end);
        chip.background.fill(colour, line, end);
        line = end;
        stripe++;
    }
}
