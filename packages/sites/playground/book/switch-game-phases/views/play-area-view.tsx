/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import type { GameModel } from '../models';
import { SCREEN_WIDTH, TEXT_STYLE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PlayAreaViewBindings {
    readonly model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A round in play: the target, the score, and a bar for the time left.
 * Click the target to hit it. This view sits in a `<Match>`, so its getters
 * run only while a round is on.
 */
export function PlayAreaView({ model }: PlayAreaViewBindings): Container {
    const scoreText = createComputed({
        watch: () => model.score,
        compute: (score) => `Hits: ${score}`,
    });

    return (
        <container>
            <text text={scoreText} x={16} y={12} style={TEXT_STYLE} />
            <graphics ref={drawTimeBarTrack} />
            <graphics x={BAR_X} y={BAR_Y} scaleX={() => model.timeLeft} ref={drawTimeBar} />
            <graphics
                x={() => model.targetX}
                y={() => model.targetY}
                cursor="pointer"
                onPointerDown={() => model.hitTarget()}
                ref={drawTarget}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Where the time bar is, and how big, in pixels. */
const BAR_X = 200;
const BAR_Y = 18;
const BAR_WIDTH = SCREEN_WIDTH - BAR_X - 16;
const BAR_HEIGHT = 10;

function drawTimeBarTrack(g: Graphics): void {
    g.rect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT).stroke({ color: 0x2a3866, width: 1 });
}

/** Drawn from its own left edge, so scaling it shrinks it towards that edge. */
function drawTimeBar(g: Graphics): void {
    g.rect(0, 0, BAR_WIDTH, BAR_HEIGHT).fill(0x7fe07f);
}

function drawTarget(g: Graphics): void {
    g.circle(0, 0, 26).fill(0xff5468);
    g.circle(0, 0, 18).fill(0xffffff);
    g.circle(0, 0, 10).fill(0xff5468);
}
