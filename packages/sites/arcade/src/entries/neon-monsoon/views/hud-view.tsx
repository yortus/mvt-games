/** @jsxImportSource @mvtjs/pixi */

import { type Container, type Graphics, Texture } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { List } from '@mvtjs/pixi';
import { measurePixelText, PixelTextView } from '#shared';
import { textures } from '../data';
import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    highScore: () => number;
    lives: () => number;
    bombs: () => number;
    chain: () => number;
    /** Time left to extend the chain, from 1 down to 0. */
    chainFraction: () => number;
    /** How full the volley's bar is, from 0 to 1. Once charged, it is the share of the volley's shots left. */
    volleyCharge: () => number;
    /** Whether the volley is charged and ready to use, however many shots it has left. The bar blinks while it is. */
    isVolleyCharged: () => boolean;
    loop: () => number;
    /** The game's step count, which times the bar's blink once it is full, so a replay blinks the same way. */
    stepCount: () => number;
    /** The screen's size, which lays out the HUD, so read once. */
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Drawn over the arena, as on a portrait cabinet: score, chain and high score
 * along the top; lives, the volley's bar and bombs along the bottom. The
 * bar fills while the ship flies close to bullets, and blinks once it is
 * charged. A charged bar shrinks as the volley's ring loses shots.
 */
export function HudView(bindings: HudViewBindings): Container {
    const { width, height } = bindings;
    const { ship, bombIcon } = textures.get();

    // Text is rebuilt only when its number changes.
    const scoreText = memoiseLast((score: number) => String(score).padStart(8, '0'));
    const highScoreText = memoiseLast((score: number) => `HI ${String(score).padStart(8, '0')}`);
    const chainText = memoiseLast((chain: number) => `${chain} CHAIN`);
    const loopText = memoiseLast((loop: number) => `LOOP ${loop}`);

    return (
        <container>
            <container x={EDGE} y={EDGE}>
                <PixelTextView text={() => scoreText(bindings.score())} color={SCORE_COLOR} />
            </container>
            <container x={width - EDGE} y={EDGE}>
                <PixelTextView text={() => highScoreText(bindings.highScore())} color={LABEL_COLOR} anchorX={1} />
            </container>
            <container x={width / 2} y={EDGE} visible={() => bindings.loop() > 1}>
                <PixelTextView text={() => loopText(bindings.loop())} color={LABEL_COLOR} anchorX={0.5} />
            </container>

            {/* The chain, and how long is left to extend it */}
            <container x={EDGE} y={EDGE + 12} visible={() => bindings.chain() > 1}>
                <PixelTextView text={() => chainText(bindings.chain())} color={NEON.cyan} />
                <sprite
                    texture={Texture.WHITE}
                    y={9}
                    height={2}
                    width={() => CHAIN_BAR_WIDTH * bindings.chainFraction()}
                    tint={NEON.cyan}
                />
            </container>

            <container x={EDGE} y={height - EDGE - ICON_SIZE}>
                <List items={{ length: bindings.lives, at: (i) => i }}>
                    {(_, i) => <sprite texture={ship.icon} x={i * (ICON_SIZE + 2)} />}
                </List>
            </container>
            {/* The volley's label and bar, centred together */}
            <container x={Math.round((width - VOLLEY_WIDTH) / 2)} y={height - EDGE}>
                <PixelTextView text={VOLLEY_LABEL} color={LABEL_COLOR} anchorY={1} />
                <container x={VOLLEY_LABEL_WIDTH + VOLLEY_GAP} y={-VOLLEY_BAR_HEIGHT - 1}>
                    <graphics ref={drawVolleyFrame} />
                    <sprite
                        texture={Texture.WHITE}
                        x={1}
                        y={1}
                        height={VOLLEY_BAR_HEIGHT - 2}
                        width={() => Math.round((VOLLEY_BAR_WIDTH - 2) * bindings.volleyCharge())}
                        tint={volleyTint}
                    />
                </container>
            </container>
            <container x={width - EDGE - ICON_SIZE} y={height - EDGE - ICON_SIZE}>
                <List items={{ length: bindings.bombs, at: (i) => i }}>
                    {(_, i) => <sprite texture={bombIcon} x={-i * (ICON_SIZE + 2)} />}
                </List>
            </container>
        </container>
    );

    function volleyTint(): number {
        if (!bindings.isVolleyCharged()) return NEON.cyan;
        return Math.floor(bindings.stepCount() / BLINK_STEPS) % 2 === 0 ? 0xffffff : NEON.cyan;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const EDGE = 4;
const ICON_SIZE = 8;
const CHAIN_BAR_WIDTH = 40;

const VOLLEY_LABEL = 'VOLLEY';
const VOLLEY_LABEL_WIDTH = measurePixelText(VOLLEY_LABEL);
const VOLLEY_GAP = 3;
/** The bar's outside size, frame included, in pixels. */
const VOLLEY_BAR_WIDTH = 42;
const VOLLEY_BAR_HEIGHT = 5;
const VOLLEY_WIDTH = VOLLEY_LABEL_WIDTH + VOLLEY_GAP + VOLLEY_BAR_WIDTH;
/** Steps between the full bar's blinks. */
const BLINK_STEPS = 6;

// The text is set in the pixel glyphs at their own size
const SCORE_COLOR = 0xffffff;
const LABEL_COLOR = 0xb7b3d9;

/** The bar's frame: a one-pixel outline, inside the bar's outside size, around a dark inside, so the rain never shows through. */
function drawVolleyFrame(g: Graphics): void {
    g.rect(1, 1, VOLLEY_BAR_WIDTH - 2, VOLLEY_BAR_HEIGHT - 2).fill(0x000000);
    g.rect(0, 0, VOLLEY_BAR_WIDTH, 1).fill(LABEL_COLOR);
    g.rect(0, VOLLEY_BAR_HEIGHT - 1, VOLLEY_BAR_WIDTH, 1).fill(LABEL_COLOR);
    g.rect(0, 1, 1, VOLLEY_BAR_HEIGHT - 2).fill(LABEL_COLOR);
    g.rect(VOLLEY_BAR_WIDTH - 1, 1, 1, VOLLEY_BAR_HEIGHT - 2).fill(LABEL_COLOR);
}
