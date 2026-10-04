/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { textures } from '../data';
import { HitFlashView } from './hit-flash-view';
import { NEON } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BossViewBindings {
    x: () => number;
    y: () => number;
    isShown: () => boolean;
    isExploding: () => boolean;
    /** Which attack it is on; the core glows a different colour for each. */
    attackIndex: () => number;
    msSinceHit: () => number;
    /** A clock that counts the game's steps, for the core's pulse and the death throes. */
    stepCount: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The Stormcore: its hull, a pulsing core, and a flash when hit. */
export function BossView(bindings: BossViewBindings): Container {
    const hull = textures.get().boss;

    return (
        <container
            x={bindings.x}
            y={bindings.y}
            visible={bindings.isShown}
            alpha={() => (bindings.isExploding() ? flicker(bindings.stepCount()) : 1)}
        >
            <sprite texture={hull} anchor={0.5} />
            <graphics
                y={CORE_Y}
                ref={drawCore}
                tint={() => CORE_COLOURS[bindings.attackIndex() % CORE_COLOURS.length]}
                scale={() => pulse(bindings.stepCount())}
            />
            <HitFlashView texture={hull} msSinceHit={bindings.msSinceHit} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The core sits a little below the hull's centre. */
const CORE_Y = 6;
const CORE_COLOURS: readonly number[] = [NEON.magenta, NEON.cyan, NEON.violet];

/** Drawn in white once, then tinted per attack and scaled to pulse. */
function drawCore(g: Graphics): void {
    g.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.35 });
    g.circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.9 });
}

function pulse(stepCount: number): number {
    return 1 + 0.15 * Math.sin(stepCount * 0.15);
}

function flicker(stepCount: number): number {
    return (stepCount >> 2) % 2 === 0 ? 1 : 0.4;
}
