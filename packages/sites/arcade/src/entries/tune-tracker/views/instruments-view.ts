import { Container } from 'pixi.js';
import type { Audio90Instrument, Audio90Song } from 'audio90';
import { setRefresh } from '@mvtjs/pixi';
import { cacheAsPixels, PANEL_LINE_X, PANEL_LINE_Y, PanelView } from './panel-view';
import { createGlyphRow, GLYPH_HEIGHT, GLYPH_WIDTH, type GlyphRow, type PixelFont } from './pixel-font';
import { DIM_TEXT_COLOR, INSTRUMENT_COLOR, PANEL_LINES, TEXT_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface InstrumentsViewBindings {
    readonly font: PixelFont;
    /** Its size, in pixels. Read once. */
    readonly width: number;
    readonly height: number;
    readonly song: () => Audio90Song;
    /** Each instrument's name, as the panel lists it. */
    readonly nameOf: (instrument: Audio90Instrument) => string;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The song's instruments, as a panel: each one's letter, as the pattern
 * names it, its name, and how it makes its sound: how many operators an
 * FM instrument has, how many oscillators an analog one stacks, and how
 * many slices a sample instrument's sample is cut into.
 */
export function InstrumentsView(bindings: InstrumentsViewBindings): Container {
    const { font, width, height } = bindings;
    const columns = Math.floor((width - 2 * PANEL_LINE_X) / GLYPH_WIDTH);
    let shown: Audio90Song | undefined;

    const view = PanelView({ font, width, height, heading: 'INSTRUMENTS' });
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
        const song = bindings.song();
        if (song === shown) return;
        shown = song;
        for (let i = 0; i < PANEL_LINES; i++) {
            const line = lines[i];
            line.clearFrom(0);
            if (i >= song.instruments.length) continue;
            const instrument = song.instruments[i];
            line.write(song.instrumentLetters[i], INSTRUMENT_COLOR, 0);
            line.write(bindings.nameOf(instrument), TEXT_COLOR, 3);
            line.write(describeEngine(instrument), DIM_TEXT_COLOR, ENGINE_COLUMN);
        }
        view.updateCacheTexture();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the engine's description starts, after the longest name. */
const ENGINE_COLUMN = 19;

/** How an instrument makes its sound, such as `FM, 4 operators`. */
function describeEngine(instrument: Audio90Instrument): string {
    const { data } = instrument;
    if (instrument.engine === 'fm') return `FM, ${data.operators.length} operators`;
    if (instrument.engine === 'sample') {
        const slices = instrument.sample?.slices ?? 1;
        return slices > 1 ? `sample, ${slices} slices` : 'sample';
    }
    return data.unison > 1 ? `analog, ${data.unison} stacked` : 'analog';
}
