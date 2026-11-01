/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';
import type { ShipModel } from '../models';
import { ShipView } from './ship-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: ShipModel;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ship, a line that says what the model thinks of the shield, and a
 * hint. Click anywhere to raise the shield again.
 */
export function GameView({ model, width, height }: GameViewBindings): Container {
    return (
        <container hitArea={new Rectangle(0, 0, width, height)} onPointerTap={() => model.raiseShield()}>
            <text
                text={() => (model.isShielded ? 'The model says: shielded' : 'The model says: not shielded')}
                x={16}
                y={14}
                style={STATUS_STYLE}
            />
            <ShipView x={() => model.x} y={() => model.y} isShielded={() => model.isShielded} />
            <text text="Click to raise the shield" anchor={0.5} x={width / 2} y={height - 22} style={HINT_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STATUS_STYLE = { fontFamily: 'monospace', fontSize: 16, fill: 0x9fe8ff };
const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x667799 };
