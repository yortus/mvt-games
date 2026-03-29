/** @jsxImportSource #pixi-jsx */

import { Container } from 'pixi.js';
import { memo } from '#pixi-jsx';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getScore(): number;
    getScreenWidth(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings): Container {
    const getScoreText = memo(bindings, (b) => `Score: ${b.getScore()}`);

    return (
        <container label="hud">
            <text
                text={getScoreText}
                x={8}
                y={8}
                style={{ fontFamily: 'monospace', fontSize: 14, fill: 0xffffff }}
            />
        </container>
    );
}
