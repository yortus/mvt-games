/** @jsxImportSource @mvtjs/pixi/jsx */
import type { Container, Graphics } from 'pixi.js';
import { ROW_COUNT } from '../../data';
import { cellCenterX, cellCenterY, REEL_COUNT, WHITE } from './pixi-layout';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface JuiceBurstViewBindings {
    /** The celebration's step: each new step bursts. Negative when not celebrating. */
    readonly stepIndex: () => number;
    readonly isLitAt: (reel: number, row: number) => boolean;
    /** The colour of the juice from a cell: its fruit's. */
    readonly colorAt: (reel: number, row: number) => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A splash of droplets from every lit cell as each celebration step begins.
 * The droplets are presentation state: a fixed pool of records, launched and
 * moved in `update`, and drawn in `refresh` as one white dot each, tinted,
 * moved, shrunk and faded. Nothing is made or destroyed while it runs.
 */
export function JuiceBurstView(bindings: JuiceBurstViewBindings): Container {
    const droplets: Droplet[] = [];
    for (let i = 0; i < POOL_SIZE; i++) droplets.push({ x: 0, y: 0, vx: 0, vy: 0, lifeMs: 0, maxLifeMs: 1, size: 1, color: WHITE });
    let nextDroplet = 0;
    let burstStep = bindings.stepIndex();
    // The splashes' own random numbers: cosmetic, so not the model's
    let seed = 1;

    return (
        <container onUpdate={update}>
            {droplets.map((droplet) => (
                <graphics
                    ref={drawDot}
                    visible={() => droplet.lifeMs > 0}
                    x={() => droplet.x}
                    y={() => droplet.y}
                    scale={() => (droplet.size / DOT_RADIUS) * (0.4 + 0.6 * (droplet.lifeMs / droplet.maxLifeMs))}
                    alpha={() => Math.min(1, (2 * droplet.lifeMs) / droplet.maxLifeMs)}
                    tint={() => droplet.color}
                />
            ))}
        </container>
    );

    function update(deltaMs: number): void {
        const step = bindings.stepIndex();
        if (step !== burstStep) {
            burstStep = step;
            if (step >= 0) burst();
        }

        const seconds = deltaMs * 0.001;
        for (let i = 0; i < droplets.length; i++) {
            const droplet = droplets[i];
            if (droplet.lifeMs <= 0) continue;
            droplet.vy += GRAVITY * seconds;
            droplet.x += droplet.vx * seconds;
            droplet.y += droplet.vy * seconds;
            droplet.lifeMs -= deltaMs;
        }
    }

    function burst(): void {
        for (let reel = 0; reel < REEL_COUNT; reel++) {
            for (let row = 0; row < ROW_COUNT; row++) {
                if (!bindings.isLitAt(reel, row)) continue;
                const color = bindings.colorAt(reel, row);
                for (let i = 0; i < DROPLETS_PER_CELL; i++) launch(cellCenterX(reel), cellCenterY(row), color);
            }
        }
    }

    function launch(x: number, y: number, color: number): void {
        const droplet = droplets[nextDroplet];
        nextDroplet = (nextDroplet + 1) % droplets.length;
        const angle = random() * Math.PI * 2;
        const speed = 140 + random() * 220;
        droplet.x = x;
        droplet.y = y;
        droplet.vx = Math.cos(angle) * speed;
        droplet.vy = Math.sin(angle) * speed - 160;
        droplet.maxLifeMs = 500 + random() * 400;
        droplet.lifeMs = droplet.maxLifeMs;
        droplet.size = 4 + random() * 5;
        droplet.color = color;
    }

    function random(): number {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Droplet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    lifeMs: number;
    maxLifeMs: number;
    size: number;
    color: number;
}

const POOL_SIZE = 96;
const DROPLETS_PER_CELL = 7;
/** Pixels per second per second. */
const GRAVITY = 900;

/** Drawn at the largest size, and scaled down: smoother than scaling up. */
const DOT_RADIUS = 9;

function drawDot(g: Graphics): void {
    g.circle(0, 0, DOT_RADIUS).fill(WHITE);
}
