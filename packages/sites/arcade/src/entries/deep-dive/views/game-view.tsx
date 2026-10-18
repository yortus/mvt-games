/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { List } from '@mvtjs/pixi';
import { memoiseLast } from '@mvtjs/utils';
import { isTouchDevice, OverlayView } from '#shared';
import { CAVE_HEIGHT, SUB_X, VIEW_WIDTH } from '../data';
import type { GameModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** Pixels per cave unit, and the screen's size in pixels. */
export const SCALE = 20;
export const SCREEN_WIDTH = VIEW_WIDTH * SCALE;
export const SCREEN_HEIGHT = CAVE_HEIGHT * SCALE;

/** The whole game: the water, the cave scrolling by, the submarine and its bubbles, the distance, and the crash panel. */
export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const distanceText = memoiseLast((metres: number) => `${metres} m`);
    const bestText = memoiseLast((metres: number) => `BEST ${metres} m`);
    const hint = isTouchDevice() ? 'Hold Rise to go up' : 'Hold Space to rise';
    const crashText = `CRASHED\n\n${isTouchDevice() ? 'Tap' : 'Press Enter'} to dive again`;

    // Presentation state: bubbles let out from the propeller, in cave units, so
    // they stay where they were let out as the cave scrolls by. The rock hides
    // any that rise into it.
    const bubbles: Bubble[] = Array.from({ length: 30 }, () => ({ x: 0, y: 0, ageMs: BUBBLE_LIFE_MS }));
    let nextBubble = 0;
    let msToNextBubble = 0;

    return (
        <container onUpdate={updateBubbles}>
            <graphics ref={drawWater} />
            <List items={bubbles}>
                {(bubble) => (
                    <graphics
                        visible={() => bubble().ageMs < BUBBLE_LIFE_MS}
                        x={() => (bubble().x - model.distance) * SCALE}
                        y={() => (bubble().y - bubble().ageMs * BUBBLE_RISE_SPEED) * SCALE}
                        alpha={() => 1 - bubble().ageMs / BUBBLE_LIFE_MS}
                        ref={(g) => g.circle(0, 0, 2.5).stroke({ color: 0xbfefff, width: 1 })}
                    />
                )}
            </List>
            <graphics onRefresh={drawCave} />
            <graphics x={SUB_X * SCALE} y={() => model.y * SCALE} rotation={() => model.ySpeed * 0.04} ref={drawSub} />
            <text text={() => distanceText(Math.floor(model.distance))} x={8} y={6} style={HUD_STYLE} />
            <text text={() => bestText(Math.floor(model.best))} x={SCREEN_WIDTH - 8} y={6} anchorX={1} style={HUD_STYLE} />
            <text text={hint} visible={() => model.phase === 'ready'} x={SCREEN_WIDTH / 2} y={SCREEN_HEIGHT / 2 + 40} anchor={0.5} style={HUD_STYLE} />
            <OverlayView
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                isVisible={() => model.phase === 'crashed'}
                text={() => crashText}
                onPressed={model.startNewRun}
            />
        </container>
    );

    /** Ages the bubbles, and lets out a new one every so often while the submarine runs: more often while it rises. */
    function updateBubbles(deltaMs: number): void {
        for (let i = 0; i < bubbles.length; i++) bubbles[i].ageMs += deltaMs;
        msToNextBubble -= deltaMs;
        if (model.phase === 'crashed' || msToNextBubble > 0) return;
        msToNextBubble = model.isBlowingTanks ? 80 : 300;
        const bubble = bubbles[nextBubble];
        nextBubble = (nextBubble + 1) % bubbles.length;
        bubble.x = model.distance + SUB_X - 0.75;
        bubble.y = model.y + (Math.random() - 0.5) * 0.3;
        bubble.ageMs = 0;
    }

    /** The rock above and below, traced along the part of the cave in view, with kelp growing from the floor. */
    function drawCave(g: Graphics): void {
        const start = model.distance;
        g.clear();
        traceRock(g, start, model.ceilingAt, -SCALE);
        traceRock(g, start, model.floorAt, SCREEN_HEIGHT + SCALE);
        // Kelp stands every so often along the floor, each its own height
        for (let k = Math.ceil(start / KELP_SPACING); k * KELP_SPACING < start + VIEW_WIDTH; k++) {
            const x = (k * KELP_SPACING - start) * SCALE;
            const floor = model.floorAt(k * KELP_SPACING) * SCALE;
            const height = (0.5 + 0.6 * Math.abs(Math.sin(k * 12.9898))) * SCALE;
            g.moveTo(x, floor).quadraticCurveTo(x + 6, floor - height / 2, x, floor - height).stroke(KELP_STROKE);
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A bubble, let out at `x` and `y` in cave units. One as old as `BUBBLE_LIFE_MS` has popped. */
interface Bubble {
    x: number;
    y: number;
    ageMs: number;
}

const BUBBLE_LIFE_MS = 1600;
/** In cave units per millisecond. */
const BUBBLE_RISE_SPEED = 0.0014;
/** How far apart the kelp stands, in cave units. */
const KELP_SPACING = 1.7;

const KELP_STROKE = { color: 0x2f8f5b, width: 3, cap: 'round' } as const;
const HUD_STYLE = { fill: 0xffffff, fontSize: 14, fontFamily: 'monospace' };

/** Deep water, lighter toward the surface, with a few faint shafts of light slanting down. */
function drawWater(g: Graphics): void {
    g.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(0x061a33);
    for (let i = 0; i < 12; i++) g.rect(0, (i * SCREEN_HEIGHT) / 12, SCREEN_WIDTH, SCREEN_HEIGHT / 12).fill({ color: 0x1b5f86, alpha: 1 - i / 11 });
    for (let x = 60; x < SCREEN_WIDTH; x += 100) g.poly([x, 0, x + 30, 0, x - 30, SCREEN_HEIGHT, x - 90, SCREEN_HEIGHT]).fill({ color: 0xffffff, alpha: 0.04 });
}

/** Fills and outlines the rock between the cave's edge (`edgeAt`) and `outerY`, just off the top or bottom of the screen. */
function traceRock(g: Graphics, start: number, edgeAt: (x: number) => number, outerY: number): void {
    g.moveTo(-SCALE, outerY);
    for (let x = -1; x <= VIEW_WIDTH + 1; x += 0.25) g.lineTo(x * SCALE, edgeAt(start + x) * SCALE);
    g.lineTo((VIEW_WIDTH + 1) * SCALE, outerY).closePath().fill(0x1c2a33).stroke({ color: 0x3c6070, width: 2 });
}

/** A yellow submarine facing right, centred on the origin: periscope, tower, hull, porthole and propeller. */
function drawSub(g: Graphics): void {
    g.moveTo(4, -9).lineTo(4, -13).lineTo(8, -13).stroke({ color: 0x8a7a2a, width: 2 });
    g.roundRect(-5, -10, 11, 6, 2).fill(0xe0b52a);
    g.ellipse(0, 0, 14, 7).fill(0xf2c94c);
    g.circle(5, -1, 2.6).fill(0x1b5f86).stroke({ color: 0x8a7a2a, width: 1 });
    g.ellipse(-16, 0, 2, 5).fill(0x8a7a2a);
}
