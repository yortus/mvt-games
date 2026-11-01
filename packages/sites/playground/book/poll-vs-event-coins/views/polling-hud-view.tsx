/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { createComputed } from '@mvtjs/utils';
import { drawCoin } from './draw-coin';
import { COIN_SPACING, EMPTY_COIN_ALPHA, HEADING_STYLE, VALUE_STYLE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PollingHudViewBindings {
    readonly coins: () => number;
    /** How many coins earn a life, read once. */
    readonly coinsPerLife: number;
    readonly lives: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A HUD that polls. Every frame, after the model has finished its update,
 * it reads the coins and the lives, so both are always final. The lives
 * text is built again only when the number changes.
 */
export function PollingHudView(bindings: PollingHudViewBindings): Container {
    const livesText = createComputed({ watch: bindings.lives, compute: (lives) => `Lives ${lives}` });

    return (
        <container>
            <text text="Polling every frame" style={HEADING_STYLE} />
            {Array.from({ length: bindings.coinsPerLife }, (_, i) => (
                <graphics
                    x={14 + i * COIN_SPACING}
                    y={58}
                    alpha={() => (i < bindings.coins() ? 1 : EMPTY_COIN_ALPHA)}
                    ref={drawCoin}
                />
            ))}
            <text text={livesText} y={90} style={VALUE_STYLE} />
        </container>
    );
}
