/** @jsxImportSource #pixi-jsx */

import type { Container } from 'pixi.js';
import { createEdgeTween } from '#common';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DeathFlashViewBindings {
    /** The flash's size, read once. */
    width: number;
    height: number;
    isDying: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A white flash over the play area when the ship dies, fading out. It drives
 * its own alpha each frame, since a smooth fade needs alpha rather than a
 * visible toggle.
 */
export function DeathFlashView(bindings: DeathFlashViewBindings): Container {
    const { width, height } = bindings;
    const tween = createEdgeTween({
        getSource: bindings.isDying,
        triggerValue: 1,
        restValue: 0,
        durationMs: FLASH_DURATION_MS,
    });

    return (
        <graphics
            alpha={() => tween.value}
            onUpdate={(deltaMs) => { tween.update(deltaMs); }}
            ref={(g) => g.rect(0, 0, width, height).fill({ color: 0xffffff })}
        />
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FLASH_DURATION_MS = 200;
