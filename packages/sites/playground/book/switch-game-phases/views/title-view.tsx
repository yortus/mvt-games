/** @jsxImportSource @mvtjs/pixi */

import { type Container, Rectangle } from 'pixi.js';
import { HEADING_STYLE, SCREEN_HEIGHT, SCREEN_WIDTH, TEXT_STYLE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TitleViewBindings {
    /** Reports a click anywhere on the title. */
    readonly onStartPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The game's name, and how to start. Click anywhere to start. */
export function TitleView(bindings: TitleViewBindings): Container {
    return (
        <container
            hitArea={new Rectangle(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)}
            onPointerTap={() => bindings.onStartPressed?.()}
        >
            <text text="TARGET PRACTICE" anchor={0.5} x={SCREEN_WIDTH / 2} y={SCREEN_HEIGHT / 2 - 30} style={HEADING_STYLE} />
            <text text="Click to start" anchor={0.5} x={SCREEN_WIDTH / 2} y={SCREEN_HEIGHT / 2 + 30} style={TEXT_STYLE} />
        </container>
    );
}
