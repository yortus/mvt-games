/** @jsxImportSource @mvtjs/pixi */

import { type Container, Texture } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { List } from '@mvtjs/pixi';
import { PixelTextView } from '#shared';
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
    grazeCount: () => number;
    loop: () => number;
    /** The screen's size, which lays out the HUD, so read once. */
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Drawn over the arena, as on a portrait cabinet: score, chain and high score
 * along the top; lives, graze count and bombs along the bottom.
 */
export function HudView(bindings: HudViewBindings): Container {
    const { width, height } = bindings;
    const { ship, bombIcon } = textures.get();

    // Text is rebuilt only when its number changes.
    const scoreText = memoiseLast((score: number) => String(score).padStart(8, '0'));
    const highScoreText = memoiseLast((score: number) => `HI ${String(score).padStart(8, '0')}`);
    const chainText = memoiseLast((chain: number) => `${chain} CHAIN`);
    const grazeText = memoiseLast((count: number) => `GRAZE ${count}`);
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
            <container x={width / 2} y={height - EDGE}>
                <PixelTextView text={() => grazeText(bindings.grazeCount())} color={LABEL_COLOR} anchorX={0.5} anchorY={1} />
            </container>
            <container x={width - EDGE - ICON_SIZE} y={height - EDGE - ICON_SIZE}>
                <List items={{ length: bindings.bombs, at: (i) => i }}>
                    {(_, i) => <sprite texture={bombIcon} x={-i * (ICON_SIZE + 2)} />}
                </List>
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const EDGE = 4;
const ICON_SIZE = 8;
const CHAIN_BAR_WIDTH = 40;

// The text is set in the pixel glyphs at their own size
const SCORE_COLOR = 0xffffff;
const LABEL_COLOR = 0xb7b3d9;
