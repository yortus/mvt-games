import { Container, Graphics, Rectangle } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import { cacheAsPixels, PanelView } from './panel-view';
import { createGlyphRow, GLYPH_HEIGHT, GLYPH_WIDTH, PLAY_GLYPH, type PixelFont, STOP_GLYPH } from './pixel-font';
import { BRIGHT_COLOR, DIM_TEXT_COLOR, HIGHLIGHT_COLOR, MUSIC_COLOR, PANEL_DARK_COLOR, PANEL_LIGHT_COLOR, TEXT_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TitleBarViewBindings {
    readonly font: PixelFont;
    /** Its size, in pixels. Read once. */
    readonly width: number;
    readonly height: number;
    readonly isPlaying: () => boolean;
    /** How long the tune has played, in ms. */
    readonly playedMs: () => number;
    /** The entry in the song's order whose row is playing, and the row playing. */
    readonly orderIndex: () => number;
    readonly row: () => number;
    /** The visitor clicked or tapped the play button. */
    readonly onPlayPressed: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The bar along the top: the program's name, a button that plays or stops
 * the tune chosen, and where the song is, as the order entry and the row in
 * hex, as the pattern shows them, and the time it has played.
 */
export function TitleBarView(bindings: TitleBarViewBindings): Container {
    const { font, width, height } = bindings;
    const watcher = watch({
        isPlaying: bindings.isPlaying,
        seconds: () => Math.floor(bindings.playedMs() / 1000),
        orderIndex: bindings.orderIndex,
        row: bindings.row,
    });
    const textY = Math.floor((height - GLYPH_HEIGHT) / 2) + 1;

    const view = PanelView({ font, width, height, heading: '' });
    const title = createGlyphRow({ font, length: TITLE.length + 1 + CHIP.length });
    title.write(TITLE, BRIGHT_COLOR, 0);
    title.write(CHIP, DIM_TEXT_COLOR, TITLE.length + 1);
    title.container.position.set(4, textY);
    view.addChild(title.container);

    // The play button, a raised key in the middle of the bar
    const button = new Container();
    const key = new Graphics();
    key.rect(0, 0, BUTTON_WIDTH, height - 2).fill(PANEL_LIGHT_COLOR);
    key.rect(1, 1, BUTTON_WIDTH - 1, height - 3).fill(PANEL_DARK_COLOR);
    key.rect(1, 1, BUTTON_WIDTH - 2, height - 4).fill(0x2c3a5e);
    button.addChild(key);
    const label = createGlyphRow({ font, length: BUTTON_LABEL_LENGTH });
    label.container.position.set(Math.floor((BUTTON_WIDTH - BUTTON_LABEL_LENGTH * GLYPH_WIDTH) / 2), textY - 1);
    button.addChild(label.container);
    button.position.set(Math.floor((width - BUTTON_WIDTH) / 2), 1);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.hitArea = new Rectangle(0, 0, BUTTON_WIDTH, height - 2);
    button.on('pointertap', () => bindings.onPlayPressed());
    view.addChild(button);

    const place = createGlyphRow({ font, length: PLACE.length });
    place.write(PLACE, DIM_TEXT_COLOR, 0);
    place.container.position.set(width - 4 - PLACE.length * GLYPH_WIDTH, textY);
    view.addChild(place.container);

    cacheAsPixels(view);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (!w.isPlaying.changed && !w.orderIndex.changed && !w.row.changed && !w.seconds.changed) return;
        if (w.isPlaying.changed) {
            const isPlaying = w.isPlaying.value;
            label.writeGlyph(isPlaying ? STOP_GLYPH : PLAY_GLYPH, isPlaying ? HIGHLIGHT_COLOR : MUSIC_COLOR, 0);
            label.write(isPlaying ? 'STOP' : 'PLAY', TEXT_COLOR, 2);
        }
        if (w.orderIndex.changed) place.writeNumber(w.orderIndex.value, 2, 16, HIGHLIGHT_COLOR, ORDER_AT);
        if (w.row.changed) place.writeNumber(w.row.value, 2, 16, HIGHLIGHT_COLOR, ROW_AT);
        if (w.seconds.changed) {
            place.writeNumber(Math.floor(w.seconds.value / 60), 2, 10, TEXT_COLOR, MINUTES_AT);
            place.writeNumber(w.seconds.value % 60, 2, 10, TEXT_COLOR, MINUTES_AT + 3);
        }
        view.updateCacheTexture();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TITLE = 'TUNE TRACKER';
const CHIP = 'for the Audio90';
const BUTTON_WIDTH = 52;
const BUTTON_LABEL_LENGTH = 6;

/** Where the song is, with room for each number, which `refresh` writes into it. */
const PLACE = 'ORDER ..  ROW ..  TIME ..:..';
const ORDER_AT = PLACE.indexOf('..');
const ROW_AT = PLACE.indexOf('ROW') + 4;
const MINUTES_AT = PLACE.indexOf('TIME') + 5;
