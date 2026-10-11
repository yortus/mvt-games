/** @jsxImportSource @mvtjs/pixi */

import { type Container, type Graphics, Texture } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import { memoiseLast } from '@mvtjs/utils';
import { drawPixels, type PixelRects } from './drawing';
import { COLOURS, HUD_FONT, HUD_HEIGHT } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    round: () => number;
    lives: () => number;
    /** The share of the meadow fenced off, and the round's target, from 0 to 1. */
    share: () => number;
    targetShare: () => number;
    /** Sheep penned this round, of how many there are. */
    sheepPenned: () => number;
    sheepCount: () => number;
    /** The screen's width, which lays out the bar, so read once. */
    width: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The bar across the top: the score and the round on the left; in the
 * middle, how much of the meadow is fenced off, against a mark for the
 * round's target; on the right, a sheep for each in the round, white once
 * penned, and a hat for each life.
 */
export function HudView(bindings: HudViewBindings): Container {
    const { width } = bindings;
    const scoreText = memoiseLast((score: number) => String(score).padStart(7, '0'));
    const roundText = memoiseLast((round: number) => `ROUND ${round}`);
    const shareText = memoiseLast((percent: number) => `${percent}%`);
    const targetText = memoiseLast((percent: number) => `/${percent}%`);

    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, width, HUD_HEIGHT).fill(COLOURS.hud)} />
            <text text={() => scoreText(bindings.score())} x={8} y={6} style={SCORE_STYLE} />
            <text text={() => roundText(bindings.round())} x={74} y={7} style={LABEL_STYLE} />

            {/* How much is fenced off, against the target */}
            <container x={BAR_X} y={8}>
                <graphics ref={(g) => g.rect(-1, -1, BAR_WIDTH + 2, 10).fill(COLOURS.earth)} />
                <sprite
                    texture={Texture.WHITE}
                    height={8}
                    width={() => Math.round(BAR_WIDTH * Math.min(1, bindings.share()))}
                    tint={() => (bindings.share() >= bindings.targetShare() ? COLOURS.flowerYellow : COLOURS.grass)}
                />
                <sprite
                    texture={Texture.WHITE}
                    x={() => Math.round(BAR_WIDTH * bindings.targetShare())}
                    y={-3}
                    width={1}
                    height={14}
                    tint={COLOURS.hudText}
                />
            </container>
            <text
                text={() => shareText(Math.floor(bindings.share() * 100))}
                x={BAR_X + BAR_WIDTH + 6}
                y={7}
                style={SCORE_LABEL_STYLE}
            />
            <text
                text={() => targetText(Math.round(bindings.targetShare() * 100))}
                x={BAR_X + BAR_WIDTH + 30}
                y={7}
                style={LABEL_STYLE}
            />

            {/* A sheep for each in the round: white once penned */}
            <container x={width - 112} y={17}>
                <List items={{ length: bindings.sheepCount, at: (i) => i }}>
                    {(_, i) => (
                        <container x={i * 10}>
                            <graphics ref={drawSheepIcon} visible={() => i < bindings.sheepPenned()} />
                            <graphics ref={drawSheepOutline} visible={() => i >= bindings.sheepPenned()} />
                        </container>
                    )}
                </List>
            </container>

            {/* A hat for each life */}
            <container x={width - 40} y={16}>
                <List items={{ length: bindings.lives, at: (i) => i }}>
                    {(_, i) => <graphics x={i * 12} ref={drawHat} />}
                </List>
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BAR_X = 150;
const BAR_WIDTH = 120;

const SCORE_STYLE = { fontFamily: HUD_FONT, fontSize: 12, fontWeight: 'bold', fill: COLOURS.hudText } as const;
const SCORE_LABEL_STYLE = { fontFamily: HUD_FONT, fontSize: 10, fontWeight: 'bold', fill: COLOURS.hudText } as const;
const LABEL_STYLE = { fontFamily: HUD_FONT, fontSize: 10, fill: COLOURS.hudDim } as const;

// Small icons, with their feet at the origin

const SHEEP_ICON: PixelRects = [
    [-3, -7, 6, 4, COLOURS.wool],
    [3, -7, 2, 2, COLOURS.sheepFace],
    [-2, -3, 1, 2, COLOURS.sheepFace],
    [1, -3, 1, 2, COLOURS.sheepFace],
];

const SHEEP_OUTLINE: PixelRects = [
    [-3, -7, 6, 1, COLOURS.hudDim],
    [-3, -4, 6, 1, COLOURS.hudDim],
    [-3, -7, 1, 4, COLOURS.hudDim],
    [2, -7, 1, 4, COLOURS.hudDim],
    [3, -7, 2, 2, COLOURS.hudDim],
];

const HAT_ICON: PixelRects = [
    [-2, -7, 5, 2, COLOURS.hat],
    [-2, -5, 5, 1, COLOURS.hatBand],
    [-4, -4, 9, 1, COLOURS.hat],
];

function drawSheepIcon(g: Graphics): void {
    drawPixels(g, SHEEP_ICON);
}

function drawSheepOutline(g: Graphics): void {
    drawPixels(g, SHEEP_OUTLINE);
}

function drawHat(g: Graphics): void {
    drawPixels(g, HAT_ICON);
}
