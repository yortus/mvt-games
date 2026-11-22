/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { PixelTextView } from '@mvtjs/site-kit/shared';
import { createComputed } from '@mvtjs/utils';
import { LAPS } from '../data';
import type { GamePhase } from '../models';
import { formatTime } from './format-time';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BoardViewBindings {
    readonly phase: () => GamePhase;
    readonly countdownMs: () => number;
    readonly lap: () => number;
    readonly lapTimeMs: () => number;
}

/** The board's size, in pixels. It's drawn into a texture this size, and shown on the gantry. */
export const BOARD_WIDTH = 512;
export const BOARD_HEIGHT = 128;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The scoreboard on the start gantry, in 2D, like a big amber display. It
 * counts down to the start, then shows the lap and its time, then FINISH.
 * It's drawn into a texture on the gantry, not on the screen.
 */
export function BoardView(bindings: BoardViewBindings): Container {
    const { phase, countdownMs, lap, lapTimeMs } = bindings;
    const left = (): string => {
        if (phase() === 'countdown') return 'GET READY';
        if (phase() === 'finished') return 'FINISH';
        return LAP_LABELS[lap()] ?? '';
    };
    // The time is built again only when its hundredths change
    const time = createComputed({ watch: () => Math.floor(lapTimeMs() / 10), compute: (hundredths) => formatTime(hundredths * 10) });
    const right = (): string => (phase() === 'countdown' ? COUNTDOWN_LABELS[Math.ceil(countdownMs() / 1000)] ?? '' : time());

    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, BOARD_WIDTH, BOARD_HEIGHT).fill(0x0e0f12).rect(6, 6, BOARD_WIDTH - 12, BOARD_HEIGHT - 12).stroke({ width: 3, color: 0x3a3d44 })} />
            <container x={EDGE} y={BOARD_HEIGHT / 2}>
                <PixelTextView text={left} color={AMBER} scale={TEXT_SCALE} anchorY={0.5} />
            </container>
            <container x={BOARD_WIDTH - EDGE} y={BOARD_HEIGHT / 2}>
                <PixelTextView text={right} color={AMBER} scale={TEXT_SCALE} anchorX={1} anchorY={0.5} />
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const AMBER = 0xffb020;
/** How far in from the board's edges the text sits, in pixels. */
const EDGE = 28;
/** How many of the board's pixels each glyph cell takes. The longest pair, such as LAP 1/3 and a time, fits side by side. */
const TEXT_SCALE = 5;

/** The labels, made once, so the board doesn't build them as it refreshes. */
const LAP_LABELS: readonly string[] = Array.from({ length: LAPS + 1 }, (_, lap) => `LAP ${lap}/${LAPS}`);
const COUNTDOWN_LABELS: readonly string[] = ['GO', '1', '2', '3', '4', '5'];
