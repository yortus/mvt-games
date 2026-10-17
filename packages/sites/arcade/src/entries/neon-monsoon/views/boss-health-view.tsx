/** @jsxImportSource @mvtjs/pixi */

import { type Container, Texture } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { List } from '@mvtjs/pixi';
import { PixelTextView } from '#shared';
import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BossHealthViewBindings {
    isShown: () => boolean;
    /** The current attack's health, from 1 down to 0. */
    healthFraction: () => number;
    /** Attacks still to come after this one, shown as pips. */
    attacksLeft: () => number;
    timeLeftMs: () => number;
    /** The bar's width, read once. */
    width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The boss's health bar for its current attack, with a pip for each attack
 * still to come and the seconds left on the clock.
 *
 * The bar slides down to the true health rather than jumping, so a burst of
 * damage reads as a burst. That slide is presentation state, kept by the
 * view: the model only knows the true health.
 */
export function BossHealthView(bindings: BossHealthViewBindings): Container {
    const { width } = bindings;
    const barWidth = width - BAR_X * 2 - TIMER_WIDTH;
    const secondsText = memoiseLast((seconds: number) => String(seconds).padStart(2, '0'));

    // Start valid: showing the true health.
    let shownFraction = bindings.healthFraction();

    return (
        <container visible={bindings.isShown} y={BAR_Y} onUpdate={slide}>
            <sprite texture={Texture.WHITE} x={BAR_X} width={barWidth} height={BAR_HEIGHT} tint={0x2a1430} />
            <sprite
                texture={Texture.WHITE}
                x={BAR_X}
                height={BAR_HEIGHT}
                width={() => barWidth * shownFraction}
                tint={NEON.magenta}
            />
            <container x={BAR_X} y={BAR_HEIGHT + 2}>
                <List items={{ length: bindings.attacksLeft, at: (i) => i }}>
                    {(_, i) => <sprite texture={Texture.WHITE} x={i * 6} width={4} height={2} tint={NEON.magenta} />}
                </List>
            </container>
            <container x={width - BAR_X} y={-2}>
                <PixelTextView text={() => secondsText(Math.ceil(bindings.timeLeftMs() / 1000))} color={TIMER_COLOR} anchorX={1} />
            </container>
        </container>
    );

    function slide(deltaMs: number): void {
        const target = bindings.healthFraction();
        // Rises at once (a new attack), falls smoothly (damage).
        shownFraction = target > shownFraction
            ? target
            : shownFraction + (target - shownFraction) * Math.min(1, deltaMs / SLIDE_MS);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BAR_X = 8;
const BAR_Y = 22;
const BAR_HEIGHT = 3;
const TIMER_WIDTH = 22;
/** Roughly how long the bar takes to catch up with the true health. */
const SLIDE_MS = 150;

/** The seconds left, set in the pixel glyphs at their own size. */
const TIMER_COLOR = 0xffd1e8;
