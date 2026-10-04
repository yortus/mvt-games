/** @jsxImportSource @mvtjs/pixi */

import { type Container, Texture } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { List } from '@mvtjs/pixi';
import { textures } from '../data';
import { HUD_FONT, NEON } from './view-constants';

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
            <text text={() => scoreText(bindings.score())} x={EDGE} y={EDGE} style={SCORE_STYLE} />
            <text
                text={() => highScoreText(bindings.highScore())}
                x={width - EDGE}
                y={EDGE + 1}
                anchorX={1}
                style={LABEL_STYLE}
            />
            <text
                text={() => loopText(bindings.loop())}
                visible={() => bindings.loop() > 1}
                x={width / 2}
                y={EDGE + 1}
                anchorX={0.5}
                style={LABEL_STYLE}
            />

            {/* The chain, and how long is left to extend it */}
            <container x={EDGE} y={EDGE + 12} visible={() => bindings.chain() > 1}>
                <text text={() => chainText(bindings.chain())} style={CHAIN_STYLE} />
                <sprite
                    texture={Texture.WHITE}
                    y={10}
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
            <text
                text={() => grazeText(bindings.grazeCount())}
                x={width / 2}
                y={height - EDGE}
                anchorX={0.5}
                anchorY={1}
                style={LABEL_STYLE}
            />
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

const SCORE_STYLE = { fontFamily: HUD_FONT, fontSize: 11, fill: 0xffffff };
const LABEL_STYLE = { fontFamily: HUD_FONT, fontSize: 9, fill: 0xb7b3d9 };
const CHAIN_STYLE = { fontFamily: HUD_FONT, fontSize: 9, fill: NEON.cyan };
