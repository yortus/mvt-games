import { Container, Sprite, Texture } from 'pixi.js';
import type { Audio90Song } from '@mvtjs/audio';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { computeListStart } from './list-window';
import { cacheAsPixels, PANEL_LINE_X, PANEL_LINE_Y, PanelView } from './panel-view';
import { createGlyphRow, GLYPH_HEIGHT, GLYPH_WIDTH, type GlyphRow, LOOP_GLYPH, PLAY_GLYPH, type PixelFont } from './pixel-font';
import { BAR_COLOR, BRIGHT_COLOR, DIM_TEXT_COLOR, HIGHLIGHT_COLOR, MUSIC_COLOR, PANEL_LINES, TEXT_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface OrderListViewBindings {
    readonly font: PixelFont;
    /** Its size, in pixels. Read once. */
    readonly width: number;
    readonly height: number;
    readonly song: () => Audio90Song;
    /** The entry in the song's order whose row is playing. */
    readonly orderIndex: () => number;
    readonly isPlaying: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The song's order, as a panel: its patterns in playing order, each with
 * the transposition its entry plays it at, such as `keys-4`. The entry
 * playing is on a bar, and an arrow marks the entry the song loops back to.
 */
export function OrderListView(bindings: OrderListViewBindings): Container {
    const { font, width, height } = bindings;
    const columns = Math.floor((width - 2 * PANEL_LINE_X) / GLYPH_WIDTH);
    const watcher = watch({ orderIndex: bindings.orderIndex, isPlaying: bindings.isPlaying });
    // The song shown, and each of its entries' names, worked out once a song
    let shown: Audio90Song | undefined;
    let names: string[] = [];

    const view = PanelView({ font, width, height, heading: 'ORDER' });
    const bar = new Sprite(Texture.WHITE);
    bar.tint = BAR_COLOR;
    bar.setSize(columns * GLYPH_WIDTH + 2, GLYPH_HEIGHT);
    bar.x = PANEL_LINE_X - 1;
    view.addChild(bar);
    const lines: GlyphRow[] = [];
    for (let i = 0; i < PANEL_LINES; i++) {
        const line = createGlyphRow({ font, length: columns });
        line.container.position.set(PANEL_LINE_X, PANEL_LINE_Y + i * GLYPH_HEIGHT);
        lines.push(line);
        view.addChild(line.container);
    }

    cacheAsPixels(view);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        const song = bindings.song();
        if (song === shown && !w.orderIndex.changed && !w.isPlaying.changed) return;
        if (song !== shown) names = song.order.map(({ pattern, transpose }) => song.patterns[pattern].name + formatTranspose(transpose));
        shown = song;
        const playing = w.orderIndex.value;
        const start = computeListStart(playing, names.length, PANEL_LINES);
        for (let i = 0; i < PANEL_LINES; i++) {
            const line = lines[i];
            const index = start + i;
            line.clearFrom(0);
            if (index >= names.length) continue;
            const isPlaying = index === playing;
            if (isPlaying && w.isPlaying.value) line.writeGlyph(PLAY_GLYPH, MUSIC_COLOR, 0);
            if (index === song.loop) line.writeGlyph(LOOP_GLYPH, HIGHLIGHT_COLOR, 1);
            line.writeNumber(index, 2, 16, isPlaying ? HIGHLIGHT_COLOR : DIM_TEXT_COLOR, 3);
            line.write(names[index], isPlaying ? BRIGHT_COLOR : TEXT_COLOR, 6);
        }
        bar.y = PANEL_LINE_Y + (playing - start) * GLYPH_HEIGHT;
        view.updateCacheTexture();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A transposition as the order writes it after a pattern's name: `+5`, `-4`, or nothing for none. */
function formatTranspose(semitones: number): string {
    if (semitones === 0) return '';
    return semitones > 0 ? `+${semitones}` : String(semitones);
}
