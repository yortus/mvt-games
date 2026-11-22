/** @jsxImportSource @mvtjs/pixi */

import { type Container, type Graphics, Rectangle } from 'pixi.js';
import { listenToPointer } from '@mvtjs/site-kit/input/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SpeedSliderViewBindings {
    /** The speed it shows, between `-maxSpeed` and `maxSpeed`. */
    readonly speed: () => number;
    /** The fastest speed either way, at the track's two ends. */
    readonly maxSpeed: number;
    /** The words over the track, such as how fast time is passing. */
    readonly label: () => string;
    /** The visitor dragged the knob, or pressed the track, to choose `speed`. */
    readonly onSpeedChosen?: (speed: number) => void;
}

/** How wide and how tall the slider is, in pixels, its label included. */
export const SPEED_SLIDER_WIDTH = 220;
export const SPEED_SLIDER_HEIGHT = 44;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A brass slider for a speed that can run either way. The middle of the
 * track is stopped, the right is forward and the left is backward. The
 * scale is squared, so the slow speeds near the middle get most of the
 * track. A knob dragged close to the middle snaps to it, and the speed
 * chosen is 0.
 */
export function SpeedSliderView(bindings: SpeedSliderViewBindings): Container {
    const { speed, maxSpeed, label, onSpeedChosen } = bindings;
    // Whether the knob is held, which lights it
    let isHeld = false;

    return (
        <container ref={listenToSeeks} hitArea={new Rectangle(0, 0, SPEED_SLIDER_WIDTH, SPEED_SLIDER_HEIGHT)} cursor="pointer">
            <graphics ref={drawPanel} />
            <text text={label} x={SPEED_SLIDER_WIDTH / 2} y={6} anchorX={0.5} style={LABEL_STYLE} />
            <graphics ref={drawTrack} />
            {/* The fill from the middle to the knob: a one-pixel bar, stretched */}
            <graphics ref={drawFill} x={TRACK_MIDDLE} y={TRACK_Y} scaleX={() => toTrackX(speed()) - TRACK_MIDDLE} />
            <graphics ref={drawKnob} x={() => toTrackX(speed())} y={TRACK_Y} tint={() => (isHeld ? HELD_TINT : 0xffffff)} />
        </container>
    );

    function listenToSeeks(target: Container): void {
        listenToPointer({
            target,
            onPressed: (x) => {
                isHeld = true;
                onSpeedChosen?.(toSpeed(x));
            },
            onMoved: (x) => onSpeedChosen?.(toSpeed(x)),
            onReleased: () => {
                isHeld = false;
            },
        });
    }

    /** Where on the track `value` sits, in pixels. */
    function toTrackX(value: number): number {
        const t = Math.sign(value) * Math.sqrt(Math.min(1, Math.abs(value) / maxSpeed));
        return TRACK_MIDDLE + t * TRACK_HALF_WIDTH;
    }

    /** The speed at `x` pixels across the slider. */
    function toSpeed(x: number): number {
        const t = Math.max(-1, Math.min(1, (x - TRACK_MIDDLE) / TRACK_HALF_WIDTH));
        if (Math.abs(t) < STOP_SNAP) return 0;
        return Math.sign(t) * t * t * maxSpeed;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The track's middle, half its length, and the height of its centre line, in pixels. */
const TRACK_MIDDLE = SPEED_SLIDER_WIDTH / 2;
const TRACK_HALF_WIDTH = SPEED_SLIDER_WIDTH / 2 - 18;
const TRACK_Y = 31;

/** How close to the middle, as a fraction of half the track, the knob stops dead. */
const STOP_SNAP = 0.06;

const BRASS = 0xd9a842;
const DARK_BRASS = 0x6e5220;
const HELD_TINT = 0xfff0c0;
const LABEL_STYLE = { fill: 0xe8d8a8, fontFamily: 'monospace', fontSize: 12 };

/** A dark plate behind the slider, so it reads over the orrery. */
function drawPanel(g: Graphics): void {
    g.roundRect(0, 0, SPEED_SLIDER_WIDTH, SPEED_SLIDER_HEIGHT, 8).fill({ color: 0x0c0a08, alpha: 0.6 });
}

/** The groove, with a notch at the middle for stopped and smaller ones at each end. */
function drawTrack(g: Graphics): void {
    const left = TRACK_MIDDLE - TRACK_HALF_WIDTH;
    g.roundRect(left, TRACK_Y - 2, TRACK_HALF_WIDTH * 2, 4, 2).fill({ color: DARK_BRASS });
    g.rect(TRACK_MIDDLE - 1, TRACK_Y - 7, 2, 14).fill({ color: BRASS });
    g.rect(left - 1, TRACK_Y - 4, 2, 8).fill({ color: DARK_BRASS });
    g.rect(left + TRACK_HALF_WIDTH * 2 - 1, TRACK_Y - 4, 2, 8).fill({ color: DARK_BRASS });
}

/** A one-pixel slice of the fill, which the view stretches from the middle to the knob. */
function drawFill(g: Graphics): void {
    g.rect(0, -2, 1, 4).fill({ color: BRASS });
}

/** A round brass knob with a darker rim, centred on the origin. */
function drawKnob(g: Graphics): void {
    g.circle(0, 0, 7).fill({ color: BRASS }).stroke({ color: DARK_BRASS, width: 2 });
}
