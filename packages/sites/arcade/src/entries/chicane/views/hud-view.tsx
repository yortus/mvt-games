/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { PixelTextView } from '@mvtjs/site-kit/shared';
import { createComputed } from '@mvtjs/utils';
import { LAPS } from '../data';
import type { GamePhase, RivalCar, Track } from '../models';
import { formatTime } from './format-time';
import { MinimapView } from './minimap-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    /** The HUD's size, in pixels. */
    readonly width: number;
    readonly height: number;
    readonly phase: () => GamePhase;
    readonly countdownMs: () => number;
    readonly raceTimeMs: () => number;
    readonly lap: () => number;
    readonly lapTimeMs: () => number;
    readonly bestLapMs: () => number | undefined;
    /** The car's speed, in metres per second. */
    readonly speed: () => number;
    /** Whether your car is a wreck, waiting to come back on the track. */
    readonly isWrecked: () => boolean;
    /** How many rivals your missiles have blown up this race. */
    readonly rivalsDestroyed: () => number;
    /** Whether a rival's missile is closing on you from behind. A warning flashes while it is. */
    readonly isMissileIncoming: () => boolean;
    readonly track: Track;
    readonly carX: () => number;
    readonly carZ: () => number;
    readonly rivals: readonly RivalCar[];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The race's readouts, drawn in 2D over the 3D scene. The lap is at the top
 * left, with the rivals you've blown up under it, and the lap time and the
 * best lap opposite. The speed is at the bottom left, and the map at the
 * bottom right. The countdown, then GO, shows big in the middle. A warning
 * flashes at the bottom while a rival's missile is closing on you.
 */
export function HudView(bindings: HudViewBindings): Container {
    const { width, height, phase, countdownMs, raceTimeMs, lap, lapTimeMs, bestLapMs, speed, isWrecked, rivalsDestroyed, isMissileIncoming, track, carX, carZ, rivals } = bindings;

    // Each label is built again only when what it shows changes: the clock by the hundredth, the speed by the km/h
    const lapLabel = createComputed({ watch: lap, compute: (n) => `LAP ${n}/${LAPS}` });
    const timeLabel = createComputed({ watch: () => Math.floor(lapTimeMs() / 10), compute: (hundredths) => `TIME ${formatTime(hundredths * 10)}` });
    const bestLabel = createComputed({ watch: bestLapMs, compute: (best) => (best === undefined ? 'BEST -:--.--' : `BEST ${formatTime(best)}`) });
    const speedLabel = createComputed({ watch: () => Math.round(Math.abs(speed()) * 3.6), compute: (kmh) => `${kmh} km/h` });
    const destroyedLabel = createComputed({ watch: rivalsDestroyed, compute: (n) => `WRECKED ${n}` });
    // The warning flashes on the race's own clock, so it flashes the same way in every run
    const isWarningVisible = (): boolean => isMissileIncoming() && Math.floor(raceTimeMs() / WARNING_FLASH_MS) % 2 === 0;
    const isGoVisible = (): boolean => phase() === 'racing' && raceTimeMs() < GO_SHOWS_MS;
    const isCalloutVisible = (): boolean => phase() === 'countdown' || isGoVisible() || isWrecked();
    const callout = (): string => {
        if (phase() === 'countdown') return COUNTDOWN_LABELS[Math.ceil(countdownMs() / 1000)] ?? '';
        return isWrecked() ? 'CRASHED!' : 'GO!';
    };

    return (
        <container>
            <container x={MARGIN} y={MARGIN}>
                <PixelTextView text={lapLabel} color={WHITE} scale={BIG_SCALE} shadow={SHADOW_COLOR} />
            </container>
            <container x={MARGIN} y={MARGIN + 30}>
                <PixelTextView text={destroyedLabel} color={WHITE} scale={SMALL_SCALE} shadow={SHADOW_COLOR} />
            </container>
            <container x={width - MARGIN} y={MARGIN}>
                <PixelTextView text={timeLabel} color={WHITE} scale={SMALL_SCALE} shadow={SHADOW_COLOR} anchorX={1} />
            </container>
            <container x={width - MARGIN} y={MARGIN + 24}>
                <PixelTextView text={bestLabel} color={WHITE} scale={SMALL_SCALE} shadow={SHADOW_COLOR} anchorX={1} />
            </container>
            <container x={MARGIN} y={height - MARGIN}>
                <PixelTextView text={speedLabel} color={WHITE} scale={BIG_SCALE} shadow={SHADOW_COLOR} anchorY={1} />
            </container>
            <container x={width - MAP_SIZE - MARGIN} y={height - MAP_SIZE - MARGIN}>
                <MinimapView track={track} size={MAP_SIZE} carX={carX} carZ={carZ} rivals={rivals} />
            </container>
            <container visible={isWarningVisible} x={width / 2} y={height - MARGIN}>
                <PixelTextView text="MISSILE BEHIND!" color={WARNING_RED} scale={BIG_SCALE} outline={OUTLINE_COLOR} anchorX={0.5} anchorY={1} />
            </container>
            <container visible={isCalloutVisible} x={width / 2} y={height * 0.42}>
                <PixelTextView text={callout} color={CALLOUT_YELLOW} scale={CALLOUT_SCALE} maxWidth={width - MARGIN * 2} outline={OUTLINE_COLOR} anchorX={0.5} anchorY={0.5} />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MARGIN = 14;
const MAP_SIZE = 110;
/** How long the missile warning shows, then hides, as it flashes, in milliseconds. A visual test times its picture by it. */
export const WARNING_FLASH_MS = 160;
/** How long GO shows after the start, in milliseconds. */
const GO_SHOWS_MS = 800;
/** The countdown's numbers, made once, so the countdown doesn't build strings. */
const COUNTDOWN_LABELS: readonly string[] = ['', '1', '2', '3', '4', '5'];

/** How many screen pixels each glyph cell takes: the lap and speed, the smaller readouts, and the countdown. */
const BIG_SCALE = 3;
const SMALL_SCALE = 2;
const CALLOUT_SCALE = 10;
const WHITE = 0xffffff;
const WARNING_RED = 0xff4a3a;
const CALLOUT_YELLOW = 0xffd23f;
/** The readouts' shadow, and the outline round the warning and the countdown, so each shows over a pale sky. */
const SHADOW_COLOR = 0x000000;
const OUTLINE_COLOR = 0x1a1a1a;
