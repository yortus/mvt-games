import { Container } from 'pixi.js';
import { computeSongDurationMs } from '@mvtjs/chiptune';
import { setRefresh } from '@mvtjs/pixi';
import type { Tune } from '#tunes';
import { cacheAsPixels, PANEL_LINE_X, PANEL_LINE_Y, PanelView } from './panel-view';
import { createGlyphRow, GLYPH_HEIGHT, GLYPH_WIDTH, type GlyphRow, type PixelFont } from './pixel-font';
import { BRIGHT_COLOR, DIM_TEXT_COLOR, HIGHLIGHT_COLOR, PANEL_LINES } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SongPanelViewBindings {
    readonly font: PixelFont;
    /** Its size, in pixels. Read once. */
    readonly width: number;
    readonly height: number;
    /** The tune chosen. */
    readonly tune: () => Tune;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * What the chosen tune is, as a panel: its name and style, then what its
 * song sets: the tempo, the rows a beat and the swing, its channels and
 * patterns, how long one pass lasts, how the chip sounds, and the effects
 * it sets up.
 */
export function SongPanelView(bindings: SongPanelViewBindings): Container {
    const { font, width, height } = bindings;
    const columns = Math.floor((width - 2 * PANEL_LINE_X) / GLYPH_WIDTH);
    let shown: Tune | undefined;

    const view = PanelView({ font, width, height, heading: 'SONG' });
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
        const tune = bindings.tune();
        if (tune === shown) return;
        shown = tune;
        const { name, style, song } = tune;
        for (const line of lines) line.clearFrom(0);
        lines[0].write(name, BRIGHT_COLOR, 0);
        lines[1].write(style, DIM_TEXT_COLOR, 0);
        writeSetting(lines[3], 'TEMPO', `${song.bpm} BPM`);
        writeSetting(lines[4], 'ROWS', `${song.rowsPerBeat} a beat`);
        writeSetting(lines[5], 'SWING', `${Math.round(song.swing * 100)}%`);
        writeSetting(lines[6], 'CHANNELS', String(song.channelCount));
        writeSetting(lines[7], 'PATTERNS', `${song.patterns.length}, ${song.order.length} in order`);
        writeSetting(lines[8], 'LENGTH', formatDuration(computeSongDurationMs(song)));
        writeSetting(lines[9], 'SOUND', song.character ?? 'unchanged');
        writeSetting(lines[10], 'EFFECTS', listEffects(song).join(' '));
        view.updateCacheTexture();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where a setting's value starts, after its name. */
const VALUE_COLUMN = 9;

function writeSetting(line: GlyphRow, name: string, value: string): void {
    line.write(name, DIM_TEXT_COLOR, 0);
    line.write(value, HIGHLIGHT_COLOR, VALUE_COLUMN);
}

/** A time in ms as minutes and seconds, such as `1:05`. */
function formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The shared effects a song sets up as it starts. */
function listEffects(song: Tune['song']): string[] {
    const effects: string[] = [];
    if (song.reverb !== undefined) effects.push('reverb');
    if (song.echo !== undefined) effects.push('echo');
    if (song.chorus !== undefined) effects.push('chorus');
    if (song.pump !== undefined) effects.push('pump');
    if (effects.length === 0) effects.push('none');
    return effects;
}
