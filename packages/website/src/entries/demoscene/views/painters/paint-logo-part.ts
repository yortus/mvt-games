import {
    BLUE, BORDER_SCROLLER_TEXT, CYAN, fadeColour, LIGHT_BLUE, LIGHT_GREY, LOGO, LOGO_SUBTITLE, PURPLE, WHITE,
} from '../../data';
import { type LogoPartModel, TURN } from '../../models';
import { bitmapIndex, COLUMNS, DISPLAY_HEIGHT, DISPLAY_TOP, HARDWARE_SPRITES, type VirtualChip } from '../chip';
import { paintRasterBars, writeWashed } from './paint-helpers';

// ---------------------------------------------------------------------------
// Painter
// ---------------------------------------------------------------------------

/**
 * Part 2. The logo is a multicolour bitmap in the top rows of an otherwise
 * text screen: the mode changes line by line. It bounces in by FLD (blank
 * lines inserted above it, pushing it and everything below down) and wobbles
 * by tech-tech (each line shifted by its own amount). The raster bars are
 * background colour, so they pass behind it. The scroller is eight sprites
 * side by side in the opened lower border, its text redrawn into their
 * shapes every frame.
 */
export function paintLogoPart(chip: VirtualChip, logo: LogoPartModel, barFlash: number): void {
    chip.border.fill(fadeColour(WHITE, barFlash));
    paintRasterBars(chip, logo, false);

    // The logo's pixels and colours, then the rest of the screen as text
    chip.bitmap.set(LOGO_PIXELS, bitmapIndex(0, LOGO_TOP_LINE));
    chip.screen.set(LOGO_SCREEN, LOGO_TOP_ROW * COLUMNS);
    chip.colour.set(LOGO_COLOURS, LOGO_TOP_ROW * COLUMNS);
    writeWashed(chip, SUBTITLE_ROW, LOGO_SUBTITLE, logo.washPhase);

    // FLD and tech-tech: which display line each frame line shows, in which mode, how far shifted
    const dropLines = Math.round(logo.dropRows * 8);
    const wobblePixels = logo.wobbleCols * 8;
    const wobblePhase = logo.wobblePhase;
    for (let y = 0; y < DISPLAY_HEIGHT; y++) {
        const line = DISPLAY_TOP + y;
        const source = y < LOGO_TOP_LINE ? y : y < LOGO_TOP_LINE + dropLines ? -1 : y - dropLines;
        chip.sourceLine[line] = source;
        if (source >= LOGO_TOP_LINE && source < LOGO_BOTTOM_LINE) {
            chip.setMode(line, line + 1, 'multicolour-bitmap');
            // Whole multicolour pixels only: two screen pixels
            chip.xOffset[line] = 2 * Math.round((wobblePixels / 2) * Math.sin(TURN * (wobblePhase + source / 40)));
        }
    }

    paintBorderScroller(chip, logo.scrollerOffset, logo.scrollerWavePhase);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The logo fills character rows 1-7, display lines 8-63. */
const LOGO_TOP_ROW = 1;
const LOGO_ROWS = 7;
const LOGO_TOP_LINE = LOGO_TOP_ROW * 8;
const LOGO_BOTTOM_LINE = LOGO_TOP_LINE + LOGO_ROWS * 8;

/** The logo's three colours: the shadow and highlight shared, the body a gradient row by row. */
const SHADOW_COLOUR = BLUE;
const HIGHLIGHT_COLOUR = WHITE;
const BODY_COLOURS: readonly number[] = [LIGHT_GREY, CYAN, CYAN, LIGHT_BLUE, LIGHT_BLUE, PURPLE, PURPLE];

const SUBTITLE_ROW = 10;

/** The scroller's sprites: eight, each 48 pixels wide when expanded, so together the frame's width. */
const SCROLLER_TOP = 230;
const SCROLLER_COLOURS: readonly number[] = [LIGHT_BLUE, CYAN, LIGHT_GREY, WHITE, WHITE, LIGHT_GREY, CYAN, LIGHT_BLUE];
/** The scroller's text starts this many characters off screen to the right: the strip's width. */
const SCROLLER_LEAD = 24;

/** The logo's rows of bitmap memory, screen memory and colour memory, built once. */
const LOGO_PIXELS = new Uint8Array(LOGO_ROWS * 320);
const LOGO_SCREEN = new Uint8Array(LOGO_ROWS * COLUMNS).fill((SHADOW_COLOUR << 4) | HIGHLIGHT_COLOUR);
const LOGO_COLOURS = new Uint8Array(LOGO_ROWS * COLUMNS);
buildLogoMemory();

function buildLogoMemory(): void {
    const left = (160 - LOGO.width) >> 1;
    for (let y = 0; y < LOGO.height; y++) {
        for (let x = 0; x < LOGO.width; x++) {
            const value = LOGO.pixels[y * LOGO.width + x];
            const px = left + x;
            const index = bitmapIndex(px >> 2, y);
            LOGO_PIXELS[index] |= value << (6 - (px & 3) * 2);
        }
    }
    for (let row = 0; row < LOGO_ROWS; row++) LOGO_COLOURS.fill(BODY_COLOURS[row], row * COLUMNS, (row + 1) * COLUMNS);
}

/** A sine scroller drawn into the shapes of eight expanded sprites, which sit in the opened lower border. */
function paintBorderScroller(chip: VirtualChip, offset: number, wavePhase: number): void {
    chip.hasOpenBorders = true;
    const text = BORDER_SCROLLER_TEXT;
    const scrollPixels = Math.floor(offset * 8);
    const shapes = chip.spriteShapes;
    const charset = chip.charset;

    // The strip is 8 sprites of 24 pixels; each column of it carries one column of a letter, raised or lowered by the wave
    for (let x = 0; x < HARDWARE_SPRITES * 24; x++) {
        const textPixel = scrollPixels + x;
        const charIndex = (textPixel >> 3) - SCROLLER_LEAD;
        if (charIndex < 0) continue;
        const code = text.charCodeAt(charIndex % text.length);
        const bit = 0x80 >> (textPixel & 7);
        const lift = Math.round(6 + 6 * Math.sin(TURN * (wavePhase + x / 64)));
        const shape = (x / 24) | 0;
        const shapeBit = x - shape * 24;
        const shapeByte = shape * 64 + (shapeBit >> 3);
        const shapeMask = 0x80 >> (shapeBit & 7);
        for (let row = 0; row < 8; row++) {
            if ((charset[code * 8 + row] & bit) !== 0) shapes[shapeByte + (lift + row) * 3] |= shapeMask;
        }
    }
    for (let i = 0; i < HARDWARE_SPRITES; i++) {
        const sprite = chip.addSprite(i * 48, SCROLLER_TOP, i, SCROLLER_COLOURS[i]);
        chip.spriteIsExpandedX[sprite] = 1;
        chip.spriteIsExpandedY[sprite] = 1;
    }
}
