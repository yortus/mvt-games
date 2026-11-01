/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How many life icons there's room for. Keep it at least the lives a game starts with. */
const MOST_LIVES_SHOWN = 5;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LivesViewBindings {
    readonly lives: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A small saucer for each life left, in a row. Room for a few is built
 * up front, and each one shows only while there are that many lives.
 */
export function LivesView(bindings: LivesViewBindings): Container {
    const icons: Container[] = [];
    for (let i = 0; i < MOST_LIVES_SHOWN; i++) {
        icons.push(<graphics x={i * ICON_SPACING} visible={() => i < bindings.lives()} ref={drawLifeIcon} />);
    }
    return <container>{icons}</container>;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How far apart the icons are, in pixels. */
const ICON_SPACING = 24;

function drawLifeIcon(g: Graphics): void {
    g.ellipse(9, 10, 4, 4).fill(0x9fe8ff);
    g.ellipse(9, 14, 9, 4).fill(0x7fe07f);
}
