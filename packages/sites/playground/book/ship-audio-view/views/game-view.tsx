/** @jsxImportSource @mvtjs/pixi */

import { type Container, type FederatedPointerEvent, type Graphics, Rectangle } from 'pixi.js';
import type { Audio80 } from 'audio90';
import type { GameModel } from '../models';
import { ShipAudioView } from './ship-audio-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: GameModel;
    /** What the game's sounds play on, read once. */
    readonly sfx: Pick<Audio80, 'play'>;
    /** The size of the play area, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ship, its shots and the rock, and beside them the ship's audio view,
 * which the game loop ticks like any other. Move the pointer to steer the
 * ship, and click to fire.
 */
export function GameView({ model, sfx, width, height }: GameViewBindings): Container {
    return (
        <container
            hitArea={new Rectangle(0, 0, width, height)}
            onPointerMove={(e: FederatedPointerEvent) => model.moveTo(e.globalX)}
            onPointerDown={(e: FederatedPointerEvent) => {
                model.moveTo(e.globalX);
                model.fire();
            }}
        >
            <text text="Move to steer, and click to fire." x={16} y={12} style={HINT_STYLE} />
            <graphics x={() => model.rockX} y={() => model.rockY} ref={(g) => drawRock(g, model.rockRadius)} />
            <graphics onRefresh={drawShots} />
            <graphics x={() => model.shipX} y={model.shipY} visible={() => model.isAlive} ref={drawShip} />
            <text text="Ship lost!" x={width / 2} y={height / 2} anchor={0.5} visible={() => !model.isAlive} style={LOST_STYLE} />
            <ShipAudioView sfx={sfx} shotsFired={() => model.shotsFired} isAlive={() => model.isAlive} />
        </container>
    );

    function drawShots(g: Graphics): void {
        g.clear();
        const shots = model.shots;
        for (let i = 0; i < shots.length; i++) g.circle(shots[i].x, shots[i].y, 4);
        if (shots.length > 0) g.fill(0xfff27a);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8b949e };
const LOST_STYLE = { fontFamily: 'monospace', fontSize: 30, fontWeight: 'bold', fill: 0xff6b5e };

function drawShip(g: Graphics): void {
    g.poly([0, -18, 18, 14, 0, 6, -18, 14]).fill(0x7fe0ff);
}

function drawRock(g: Graphics, radius: number): void {
    g.poly([
        -radius, -4, -12, -radius, 8, -radius + 2, radius, -6,
        radius - 4, 12, 6, radius, -14, radius - 4,
    ]).fill(0x8a7a6a).stroke({ color: 0xb8a898, width: 2 });
}
