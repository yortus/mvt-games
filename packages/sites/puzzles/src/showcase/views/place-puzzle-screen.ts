import { placeScreen, type ScreenPlacement } from '@mvtjs/site-kit/showcase';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../data';
import type { PaperLayout } from '../models';
import { LEAF_Y } from './view-constants';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PlacePuzzleScreenOptions {
    readonly layout: PaperLayout;
    /** The spread whose puzzle it is, open on the desk. */
    readonly spread: number;
    /** The puzzle's play area, in its own pixels. Its box on the page is the same shape. */
    readonly playWidth: number;
    readonly playHeight: number;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Returns where the box of the puzzle on `spread` lies on the desk, as a
 * screen lying flat, facing up, with its top toward the tops of the pages.
 * That's what the camera frames as the reader leans in, so the puzzle, once
 * it plays over the paper, lines up with its box. Returns undefined for a
 * spread without a puzzle.
 */
export function placePuzzleScreen({ layout, spread, playWidth, playHeight }: PlacePuzzleScreenOptions): ScreenPlacement | undefined {
    const { puzzlePage, puzzleBox } = layout.spreads[spread];
    if (puzzlePage === undefined || puzzleBox === undefined) return undefined;
    // A spread's left page has an odd index in the list, and lies left of the spine
    const pageLeft = puzzlePage % 2 === 1 ? -PAGE_WIDTH : 0;
    return placeScreen({
        x: pageLeft + (puzzleBox.x + puzzleBox.width / 2) * PAGE_WIDTH,
        y: LEAF_Y,
        z: -PAGE_HEIGHT / 2 + (puzzleBox.y + puzzleBox.height / 2) * PAGE_HEIGHT,
        // Its front faces toward the reader, then it leans all the way back, to lie flat
        facing: Math.PI / 2,
        tilt: Math.PI / 2,
        playWidth,
        playHeight,
        maxWidth: puzzleBox.width * PAGE_WIDTH,
        maxHeight: puzzleBox.height * PAGE_HEIGHT,
    });
}
