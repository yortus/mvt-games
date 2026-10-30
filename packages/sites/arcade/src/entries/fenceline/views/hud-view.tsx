/** @jsxImportSource @mvtjs/pixi */

import { type Container, type Graphics, Texture } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import { createComputed } from '@mvtjs/utils';
import { PixelTextView } from '#shared';
import { drawPixels, type PixelRects } from './drawing';
import { COLOURS, HUD_HEIGHT } from './view-constants';

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
 * The bar across the top. The score and the round are on the left. In the
 * middle, a bar shows how much of the meadow is fenced off, against a mark
 * for the round's target. On the right are a sheep for each in the round,
 * white once penned, and a hat for each life. Past three lives, one hat
 * shows with the count beside it.
 */
export function HudView(bindings: HudViewBindings): Container {
    const { width, share, targetShare } = bindings;
    const scoreText = createComputed({ watch: bindings.score, compute: (score) => String(score).padStart(7, '0') });
    const roundText = createComputed({ watch: bindings.round, compute: (round) => `ROUND ${round}` });
    const shareText = createComputed({ watch: () => Math.floor(share() * 100), compute: (percent) => `${percent}%` });
    const targetText = createComputed({ watch: () => Math.round(targetShare() * 100), compute: (percent) => `/${percent}%` });
    const livesText = createComputed({ watch: bindings.lives, compute: (lives) => `x${lives}` });

    return (
        <container>
            <graphics ref={(g) => g.rect(0, 0, width, HUD_HEIGHT).fill(COLOURS.hud)} />
            <container x={8} y={TEXT_Y}>
                <PixelTextView text={scoreText} color={COLOURS.hudText} />
            </container>
            <container x={74} y={TEXT_Y}>
                <PixelTextView text={roundText} color={COLOURS.hudDim} />
            </container>

            {/* How much is fenced off, against the target */}
            <container x={BAR_X} y={8}>
                <graphics ref={(g) => g.rect(-1, -1, BAR_WIDTH + 2, 10).fill(COLOURS.earth)} />
                <sprite
                    texture={Texture.WHITE}
                    height={8}
                    width={() => Math.round(BAR_WIDTH * Math.min(1, share()))}
                    tint={() => (share() >= targetShare() ? COLOURS.flowerYellow : COLOURS.grass)}
                />
                <sprite
                    texture={Texture.WHITE}
                    x={() => Math.round(BAR_WIDTH * targetShare())}
                    y={-3}
                    width={1}
                    height={14}
                    tint={COLOURS.hudText}
                />
            </container>
            <container x={BAR_X + BAR_WIDTH + 6} y={TEXT_Y}>
                <PixelTextView text={shareText} color={COLOURS.hudText} />
            </container>
            <container x={BAR_X + BAR_WIDTH + 30} y={TEXT_Y}>
                <PixelTextView text={targetText} color={COLOURS.hudDim} />
            </container>

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

            {/* A hat for each life, or with more lives than fit, one hat and the count */}
            <container x={width - 40} y={16}>
                <List items={{ length: () => countHats(bindings.lives()), at: (i) => i }}>
                    {(_, i) => <graphics x={i * 12} ref={drawHat} />}
                </List>
                <container x={7} y={TEXT_Y - 16} visible={() => bindings.lives() > MAX_HATS}>
                    <PixelTextView text={livesText} color={COLOURS.hudText} />
                </container>
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BAR_X = 150;
/** The most lives shown as hats, which is as many as fit. */
const MAX_HATS = 3;
const BAR_WIDTH = 120;

/** The text's top: the pixel glyphs at their own size, level with the middle of the bar. */
const TEXT_Y = 9;

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

/** How many hats to show for `lives`: one each, or just one with the count beside it when they don't fit. */
function countHats(lives: number): number {
    return lives > MAX_HATS ? 1 : lives;
}

function drawSheepIcon(g: Graphics): void {
    drawPixels(g, SHEEP_ICON);
}

function drawSheepOutline(g: Graphics): void {
    drawPixels(g, SHEEP_OUTLINE);
}

function drawHat(g: Graphics): void {
    drawPixels(g, HAT_ICON);
}
