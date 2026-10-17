import { Container, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import {
    INK_BAR_ROW, INK_BEAT_ROW, INK_BLANK, INK_COUNT, INK_DOT, INK_EFFECT, INK_INSTRUMENT, INK_NOTE, INK_RELEASE, INK_ROW, INK_RULE, INK_VOLUME,
    type PatternSheet,
} from './pattern-sheet';
import { cacheAsPixels } from './panel-view';
import { createGlyphRow, GLYPH_HEIGHT, GLYPH_WIDTH, type GlyphRow, type PixelFont } from './pixel-font';
import {
    BAR_COLOR, BAR_ROW_COLOR, BEAT_ROW_COLOR, BEAT_SHADE_COLOR, DOT_COLOR, EFFECT_COLOR, INSTRUMENT_COLOR, NOTE_COLOR, RELEASE_COLOR, ROW_COLOR,
    RULE_COLOR, SCREEN_WIDTH, VOLUME_COLOR, WELL_COLOR,
} from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PatternViewBindings {
    readonly font: PixelFont;
    /** How many lines it shows, and its height in pixels. Read once. */
    readonly lineCount: number;
    readonly height: number;
    /** The song's patterns, laid out. */
    readonly sheet: () => PatternSheet;
    /** The entry in the song's order whose row is playing, and the row within its pattern. */
    readonly orderIndex: () => number;
    readonly row: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The pattern, as a tracker shows it while a song plays: the row playing
 * held on a bar across the middle, and the rows around it, which move up
 * past the bar a row at a time. The rows before and after are the ones the
 * song plays before and after it, so the next pattern follows the last row
 * of this one, and the loop point follows the end. Rows of another pattern
 * than the one playing are dimmed. Each line is copied from the sheet when
 * the row changes, so the view allocates nothing as the song plays.
 */
export function PatternView(bindings: PatternViewBindings): Container {
    const { font, lineCount, height } = bindings;
    const middle = Math.floor((lineCount - 1) / 2);
    const top = Math.floor((height - lineCount * GLYPH_HEIGHT) / 2);
    const watcher = watch({ orderIndex: bindings.orderIndex, row: bindings.row });
    // The sheet the lines are laid out for
    let shown: PatternSheet | undefined;

    const view = new Container();
    const well = new Sprite(Texture.WHITE);
    well.tint = WELL_COLOR;
    well.setSize(SCREEN_WIDTH, height);
    view.addChild(well);
    const lines = new Container();
    lines.y = top;
    view.addChild(lines);
    // The beats' shades and the bar sit under every line, the bar over the shades
    const shades: Sprite[] = [];
    for (let i = 0; i < lineCount; i++) {
        const shade = new Sprite(Texture.WHITE);
        shade.tint = BEAT_SHADE_COLOR;
        shade.y = i * GLYPH_HEIGHT;
        shades.push(shade);
        lines.addChild(shade);
    }
    const bar = new Sprite(Texture.WHITE);
    bar.tint = BAR_COLOR;
    bar.y = middle * GLYPH_HEIGHT;
    lines.addChild(bar);
    const rows: GlyphRow[] = [];
    for (let i = 0; i < lineCount; i++) {
        const row = createGlyphRow({ font, length: MAX_COLUMNS });
        row.container.y = i * GLYPH_HEIGHT;
        rows.push(row);
        lines.addChild(row.container);
    }

    cacheAsPixels(lines);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        const sheet = bindings.sheet();
        if (sheet === shown && !w.orderIndex.changed && !w.row.changed) return;
        if (sheet !== shown) layOut(sheet);
        const playing = w.orderIndex.value;

        // The row playing and those before it, back to the song's start
        let orderIndex = playing;
        let row = w.row.value;
        for (let i = middle; i >= 0; i--) {
            writeLine(i, sheet, orderIndex, row, playing);
            row--;
            if (row < 0 && orderIndex >= 0) {
                orderIndex--;
                row = orderIndex < 0 ? 0 : sheet.song.patterns[sheet.song.order[orderIndex].pattern].rowCount - 1;
            }
        }
        // The rows after it, as the song plays them, round its loop
        orderIndex = playing;
        row = w.row.value;
        for (let i = middle + 1; i < lineCount; i++) {
            row++;
            if (orderIndex >= 0 && row >= sheet.song.patterns[sheet.song.order[orderIndex].pattern].rowCount) {
                orderIndex++;
                row = 0;
                if (orderIndex >= sheet.song.order.length) orderIndex = sheet.song.loop;
            }
            writeLine(i, sheet, orderIndex, row, playing);
        }
        lines.updateCacheTexture();
    }

    /** Centres the lines for `sheet`, and fits the bar and the shades to them. */
    function layOut(sheet: PatternSheet): void {
        shown = sheet;
        const width = sheet.width * GLYPH_WIDTH;
        lines.x = Math.floor((SCREEN_WIDTH - width) / 2);
        bar.setSize(width, GLYPH_HEIGHT);
        for (let i = 0; i < lineCount; i++) shades[i].setSize(width, GLYPH_HEIGHT);
    }

    /** Copies row `row` of order entry `orderIndex` into line `i`, or blanks it for an entry of -1, before the song's start or after its end. */
    function writeLine(i: number, sheet: PatternSheet, orderIndex: number, row: number, playing: number): void {
        const line = rows[i];
        if (orderIndex < 0) {
            line.clearFrom(0);
            shades[i].visible = false;
            return;
        }
        const pattern = sheet.song.order[orderIndex].pattern;
        const glyphs = sheet.glyphs[pattern];
        const inks = sheet.inks[pattern];
        const at = row * sheet.width;
        for (let column = 0; column < sheet.width; column++) line.writeGlyph(glyphs[at + column], INK_COLORS[inks[at + column]], column);
        line.clearFrom(sheet.width);
        line.container.alpha = orderIndex === playing ? 1 : OTHER_PATTERN_ALPHA;
        shades[i].visible = i !== middle && row % sheet.song.rowsPerBeat === 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most characters a line can have: as many as fit across the screen. */
const MAX_COLUMNS = Math.floor(SCREEN_WIDTH / GLYPH_WIDTH);

/** How bright the rows of another pattern than the one playing are. */
const OTHER_PATTERN_ALPHA = 0.45;

/** Each ink's colour, by its `INK_*` number. */
const INK_COLORS: readonly number[] = (() => {
    const colors = new Array<number>(INK_COUNT).fill(0xffffff);
    colors[INK_BLANK] = 0xffffff;
    colors[INK_DOT] = DOT_COLOR;
    colors[INK_NOTE] = NOTE_COLOR;
    colors[INK_RELEASE] = RELEASE_COLOR;
    colors[INK_INSTRUMENT] = INSTRUMENT_COLOR;
    colors[INK_VOLUME] = VOLUME_COLOR;
    colors[INK_EFFECT] = EFFECT_COLOR;
    colors[INK_RULE] = RULE_COLOR;
    colors[INK_ROW] = ROW_COLOR;
    colors[INK_BEAT_ROW] = BEAT_ROW_COLOR;
    colors[INK_BAR_ROW] = BAR_ROW_COLOR;
    return colors;
})();
