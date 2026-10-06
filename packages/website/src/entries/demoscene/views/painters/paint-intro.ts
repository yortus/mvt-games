import { fadeColour, INTRO_CAPTIONS, WHITE } from '../../data';
import type { IntroModel } from '../../models';
import { centredCol, paintRasterBars, writeText } from './paint-helpers';
import type { VirtualChip } from '../chip';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Part 1. Raster bars across the whole frame, borders included, and a
 * caption fading up and down through the fade table, in front of them.
 */
export function paintIntro(chip: VirtualChip, intro: IntroModel): void {
    paintRasterBars(chip, intro, true);
    const caption = intro.captionIndex;
    if (caption < 0) return;
    const text = INTRO_CAPTIONS[caption];
    writeText(chip, 12, centredCol(text), text, fadeColour(WHITE, intro.captionBrightness));
}
