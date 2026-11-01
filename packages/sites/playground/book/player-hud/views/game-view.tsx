/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import type { PlayerModel } from '../models';
import { ButtonView } from './button-view';
import { PlayerHudView } from './player-hud-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: PlayerModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The HUD on its panel, and a button for each thing that can happen to the
 * player. A button is greyed out while the model would ignore it.
 */
export function GameView({ model }: GameViewBindings): Container {
    return (
        <container>
            <graphics ref={(g) => g.roundRect(40, 40, 560, 110, 14).fill(0x1d2740).stroke({ color: 0x3a4a70, width: 2 })} />
            <PlayerHudView score={() => model.score} isHurt={() => model.isHurt} isBuffed={() => model.isBuffed} />
            <text text="Press the buttons in any order." x={320} y={232} anchor={0.5} style={HINT_STYLE} />
            <ButtonView label="Coin" x={110} y={270} onPressed={model.collectCoin} />
            <ButtonView label="Hit" x={260} y={270} isEnabled={() => !model.isHurt} onPressed={model.takeHit} />
            <ButtonView label="Power-up" x={410} y={270} isEnabled={() => !model.isBuffed} onPressed={model.pickUpPowerUp} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8b949e };
