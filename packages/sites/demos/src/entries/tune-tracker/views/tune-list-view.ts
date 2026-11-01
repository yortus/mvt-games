import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { computeListStart } from './list-window';
import { cacheAsPixels, PANEL_LINE_X, PANEL_LINE_Y, PanelView } from './panel-view';
import { createGlyphRow, GLYPH_HEIGHT, GLYPH_WIDTH, type GlyphRow, PLAY_GLYPH, type PixelFont } from './pixel-font';
import { BAR_COLOR, BRIGHT_COLOR, HIGHLIGHT_COLOR, MUSIC_COLOR, PANEL_LINES, TEXT_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TuneListViewBindings {
    readonly font: PixelFont;
    /** Its size, in pixels. Read once. */
    readonly width: number;
    readonly height: number;
    /** Each tune's name, in order. Read once. */
    readonly names: readonly string[];
    readonly tuneIndex: () => number;
    readonly isPlaying: () => boolean;
    /** The visitor clicked or tapped tune `index`. */
    readonly onTuneChosen: (index: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The tunes, as a panel: the one chosen on a bar, marked as it plays. Clicking or tapping a tune chooses it. */
export function TuneListView(bindings: TuneListViewBindings): Container {
    const { font, width, height, names } = bindings;
    const columns = Math.floor((width - 2 * PANEL_LINE_X) / GLYPH_WIDTH);
    const watcher = watch({ tuneIndex: bindings.tuneIndex, isPlaying: bindings.isPlaying });
    let start = 0;

    const view = PanelView({ font, width, height, heading: 'TUNES' });
    const bar = new Sprite(Texture.WHITE);
    bar.tint = BAR_COLOR;
    bar.setSize(columns * GLYPH_WIDTH + 2, GLYPH_HEIGHT);
    bar.x = PANEL_LINE_X - 1;
    view.addChild(bar);
    const lines: GlyphRow[] = [];
    for (let i = 0; i < PANEL_LINES; i++) {
        const line = createGlyphRow({ font, length: columns });
        line.container.position.set(PANEL_LINE_X, PANEL_LINE_Y + i * GLYPH_HEIGHT);
        line.container.eventMode = 'static';
        line.container.cursor = 'pointer';
        line.container.hitArea = new Rectangle(0, 0, columns * GLYPH_WIDTH, GLYPH_HEIGHT);
        line.container.on('pointertap', () => {
            if (start + i < names.length) bindings.onTuneChosen(start + i);
        });
        lines.push(line);
        view.addChild(line.container);
    }
    // The watcher sees only changes from here on, so the first list is written now, before the first cached render
    writeList(bindings.tuneIndex(), bindings.isPlaying());

    cacheAsPixels(view);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (!w.anyChanged) return;
        writeList(w.tuneIndex.current, w.isPlaying.current);
        view.updateCacheTexture();
    }

    function writeList(chosen: number, isPlaying: boolean): void {
        start = computeListStart(chosen, names.length, PANEL_LINES);
        for (let i = 0; i < PANEL_LINES; i++) {
            const line = lines[i];
            const index = start + i;
            line.clearFrom(0);
            if (index >= names.length) continue;
            const isChosen = index === chosen;
            if (isChosen && isPlaying) line.writeGlyph(PLAY_GLYPH, MUSIC_COLOR, 0);
            line.writeNumber(index + 1, 2, 10, isChosen ? HIGHLIGHT_COLOR : TEXT_COLOR, 2);
            line.write(names[index], isChosen ? BRIGHT_COLOR : TEXT_COLOR, 5);
        }
        bar.y = PANEL_LINE_Y + (chosen - start) * GLYPH_HEIGHT;
    }
}
