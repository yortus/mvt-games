/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LightViewBindings {
    /** The light's colour, read once. */
    readonly color: number;
    /** Where the light's middle is, read once. */
    readonly x: number;
    readonly y: number;
    readonly isLit: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * One light, dim or lit. Both looks are drawn once, and `visible` functions
 * show whichever one matches `isLit`, so nothing is redrawn as it changes.
 */
export function LightView(bindings: LightViewBindings): Container {
    const { color } = bindings;
    return (
        <container x={bindings.x} y={bindings.y}>
            <graphics
                visible={() => !bindings.isLit()}
                ref={(g) => g.circle(0, 0, 35).fill({ color, alpha: 0.15 })}
            />
            <container visible={bindings.isLit}>
                <graphics ref={(g) => g.circle(0, 0, 35).fill({ color })} />
                {/* A glow around the lit light */}
                <graphics ref={(g) => g.circle(0, 0, 40).fill({ color, alpha: 0.2 })} />
            </container>
        </container>
    );
}
