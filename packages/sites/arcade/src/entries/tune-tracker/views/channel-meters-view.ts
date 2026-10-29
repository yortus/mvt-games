import { Container, Sprite, Texture } from 'pixi.js';
import { AUDIO90_VOICE_COUNT, type Scope, SCOPE_POINTS } from 'audio90';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import type { PatternSheet } from './pattern-sheet';
import { createGlyphRow, GLYPH_HEIGHT, GLYPH_WIDTH, type PixelFont } from './pixel-font';
import { DIM_TEXT_COLOR, HEADING_COLOR, MUSIC_COLOR, PANEL_DARK_COLOR, SCREEN_WIDTH, WELL_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ChannelMetersViewBindings {
    readonly font: PixelFont;
    /** Its height, in pixels. Read once. */
    readonly height: number;
    /** The song's patterns, laid out: each meter sits over its channel's column. */
    readonly sheet: () => PatternSheet;
    /**
     * What each of the chip's voices is playing, and where it sits. The chip
     * fills it, so the view reads it once and its arrays' contents every
     * frame. A channel with no voice in the scope, as on a chip that is still
     * silent, shows as a silent voice.
     */
    readonly scope: Scope;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A meter over each channel of the pattern: the channel's number, a scope
 * of what its voice plays, scaled to the voice's own peak so a quiet voice
 * still shows its shape, and below it the voice's level and pan. The level
 * falls back smoothly after each peak, as a meter's needle did, which is
 * presentation state, advanced in the update step.
 */
export function ChannelMetersView(bindings: ChannelMetersViewBindings): Container {
    const { font, height } = bindings;
    const { points: scopePoints, pans, voiceCount } = bindings.scope;
    // The sheet the meters are laid out for
    let shown: PatternSheet | undefined;
    // Each voice's level, from 0 to 1, which falls back from its peaks
    const levels = new Float64Array(AUDIO90_VOICE_COUNT);
    let channelCount = 0;

    const view = new Container();
    const meters: Meter[] = [];
    for (let channel = 0; channel < AUDIO90_VOICE_COUNT; channel++) meters.push(createMeter(channel));

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function createMeter(channel: number): Meter {
        const container = new Container();
        container.visible = false;
        view.addChild(container);
        const label = createGlyphRow({ font, length: 2 });
        label.writeNumber(channel + 1, 2, 10, HEADING_COLOR, 0);
        container.addChild(label.container);
        const well = createBlock(container, WELL_COLOR);
        well.y = SCOPE_Y;
        const track = createBlock(container, PANEL_DARK_COLOR);
        track.y = LEVEL_Y;
        const level = createBlock(container, MUSIC_COLOR);
        level.y = LEVEL_Y;
        const pan = createBlock(container, DIM_TEXT_COLOR);
        pan.y = PAN_Y;
        pan.setSize(PAN_MARK_WIDTH, PAN_MARK_HEIGHT);
        const points: Sprite[] = [];
        for (let i = 0; i < SCOPE_POINTS; i++) points.push(createBlock(container, MUSIC_COLOR));
        return { container, well, track, level, pan, points, width: 0 };
    }

    function createBlock(parent: Container, color: number): Sprite {
        const block = new Sprite(Texture.WHITE);
        block.tint = color;
        parent.addChild(block);
        return block;
    }

    function update(deltaMs: number): void {
        const fall = deltaMs / LEVEL_FALL_MS;
        for (let v = 0; v < AUDIO90_VOICE_COUNT; v++) {
            const peak = Math.min(1, measurePeak(v) * LEVEL_GAIN);
            levels[v] = Math.max(peak, levels[v] - fall);
        }
    }

    function refresh(): void {
        const sheet = bindings.sheet();
        if (sheet !== shown) layOut(sheet);
        for (let v = 0; v < channelCount; v++) drawMeter(meters[v], v);
    }

    /** Puts each meter over its channel's column, and hides the meters of voices the song has no channel for. */
    function layOut(sheet: PatternSheet): void {
        shown = sheet;
        channelCount = sheet.song.channelCount;
        const left = Math.floor((SCREEN_WIDTH - sheet.width * GLYPH_WIDTH) / 2);
        for (let v = 0; v < AUDIO90_VOICE_COUNT; v++) {
            const meter = meters[v];
            meter.container.visible = v < channelCount;
            if (v >= channelCount) continue;
            const width = sheet.channelWidths[v] * GLYPH_WIDTH - 2;
            meter.width = width;
            meter.container.position.set(left + sheet.channelColumns[v] * GLYPH_WIDTH, Math.floor((height - METER_HEIGHT) / 2));
            meter.well.setSize(width, SCOPE_HEIGHT);
            meter.track.setSize(width, LEVEL_HEIGHT);
            for (let i = 0; i < SCOPE_POINTS; i++) {
                const point = meter.points[i];
                point.x = Math.round(i * (width - 1) / (SCOPE_POINTS - 1));
                point.setSize(1, 1);
            }
        }
    }

    function drawMeter(meter: Meter, v: number): void {
        const at = v * SCOPE_POINTS;
        const peak = measurePeak(v);
        const scale = peak > 0 ? 1 / Math.max(peak, QUIETEST_SHAPE) : 0;
        const middle = SCOPE_Y + SCOPE_HEIGHT / 2;
        const half = SCOPE_HEIGHT / 2 - 1;
        for (let i = 0; i < SCOPE_POINTS; i++) {
            // A silent voice, or a channel with no voice in the scope, draws a flat line
            meter.points[i].y = Math.round(middle - 0.5 - (scale === 0 ? 0 : scopePoints[at + i] * scale * half));
        }
        meter.level.setSize(Math.round(meter.width * levels[v]), LEVEL_HEIGHT);
        meter.pan.visible = peak > 0;
        if (peak > 0) meter.pan.x = Math.round((pans[v] + 1) / 2 * (meter.width - PAN_MARK_WIDTH));
    }

    /** The loudest sample in voice `v`'s scope, from 0 to 1. A channel with no voice in the scope is silent. */
    function measurePeak(v: number): number {
        if (v >= voiceCount) return 0;
        const at = v * SCOPE_POINTS;
        let peak = 0;
        for (let i = 0; i < SCOPE_POINTS; i++) peak = Math.max(peak, Math.abs(scopePoints[at + i]));
        return peak;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** One channel's meter, and the sprites it is drawn with. */
interface Meter {
    readonly container: Container;
    readonly well: Sprite;
    readonly track: Sprite;
    readonly level: Sprite;
    readonly pan: Sprite;
    readonly points: readonly Sprite[];
    /** Its width, in pixels, for the channel it sits over. */
    width: number;
}

// The meter's parts, from its top: the number, the scope, the level and the pan's mark under it
const SCOPE_Y = GLYPH_HEIGHT;
const SCOPE_HEIGHT = 16;
const LEVEL_Y = SCOPE_Y + SCOPE_HEIGHT + 2;
const LEVEL_HEIGHT = 2;
const PAN_Y = LEVEL_Y + LEVEL_HEIGHT + 1;
const PAN_MARK_WIDTH = 3;
const PAN_MARK_HEIGHT = 2;
const METER_HEIGHT = PAN_Y + PAN_MARK_HEIGHT;

/** A level below which a waveform is not scaled up further, so a voice fading out does not show its noise at full height. */
const QUIETEST_SHAPE = 0.02;
/** How much the level magnifies a voice's peak. A voice in a full mix seldom peaks above half. */
const LEVEL_GAIN = 2;
/** How long the level takes to fall from full to nothing. */
const LEVEL_FALL_MS = 600;
