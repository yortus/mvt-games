import { canvasTest } from 'v-snap';
import { TUNES } from '#tunes';
import { textures } from '../../data';
import { createPatternSheet } from '../pattern-sheet';
import { PatternView } from '../pattern-view';
import { createPixelFont } from '../pixel-font';
import { PATTERN_HEIGHT, PATTERN_LINES, SCREEN_WIDTH } from '../view-constants';

const SIZE = { width: SCREEN_WIDTH, height: PATTERN_HEIGHT, pixelArt: true };
// The first tune: four patterns of drums and bass, then the keys, in an order that loops back to its third entry
const SONG = TUNES[0].song;

async function posePattern(orderIndex: number, row: number): Promise<ReturnType<typeof PatternView>> {
    await textures.load();
    const font = createPixelFont({ sheet: textures.get().font });
    const sheet = createPatternSheet({ song: SONG });
    return PatternView({ font, lineCount: PATTERN_LINES, height: PATTERN_HEIGHT, sheet: () => sheet, orderIndex: () => orderIndex, row: () => row });
}

// Nothing plays before the song's start, so the lines above the bar are blank
canvasTest('at the first row', SIZE, () => posePattern(0, 0));
// The keys' chords on the bar, the rest of their pattern below it and the drums' pattern above it, dimmed
canvasTest('in the middle of a pattern', SIZE, () => posePattern(4, 8));
// The pattern just started on the bar, and the one before it dimmed above
canvasTest('just past the join of two patterns', SIZE, () => posePattern(5, 1));
// The last row of the order on the bar, and the entry the song loops back to below it
canvasTest('at the end, before the loop', SIZE, () => posePattern(SONG.order.length - 1, SONG.patterns[SONG.order[SONG.order.length - 1].pattern].rowCount - 1));
