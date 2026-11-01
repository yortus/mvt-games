/** @jsxImportSource @mvtjs/pixi */

import { type Container, type Graphics, Rectangle } from 'pixi.js';
import type { PlayerModel } from '../models';
import { EventHudView } from './event-hud-view';
import { PollingHudView } from './polling-hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: PlayerModel;
    /** The size of the screen, in pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Two HUDs of the same model, side by side: one told by an event, and one
 * that polls. Click anywhere to pick up a coin.
 */
export function GameView({ model, width, height }: GameViewBindings): Container {
    return (
        <container hitArea={new Rectangle(0, 0, width, height)} onPointerTap={() => model.pickUpCoin()}>
            <graphics ref={(g) => drawDivider(g, width, height)} />
            <container x={48} y={80}>
                <EventHudView model={model} />
            </container>
            <container x={width / 2 + 48} y={80}>
                <PollingHudView coins={() => model.coins} coinsPerLife={model.coinsPerLife} lives={() => model.lives} />
            </container>
            <text
                text={`Every ${model.coinsPerLife} coins earn a life`}
                anchor={0.5}
                x={width / 2}
                y={height - 58}
                style={HINT_STYLE}
            />
            <text
                text="A coin is picked up every so often, or when you click"
                anchor={0.5}
                x={width / 2}
                y={height - 36}
                style={HINT_STYLE}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 13, fill: 0x667799 };

function drawDivider(g: Graphics, width: number, height: number): void {
    g.moveTo(width / 2, 60).lineTo(width / 2, height - 90).stroke({ color: 0x2a3866, width: 2 });
}
