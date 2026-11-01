import { Container, Graphics, Text } from 'pixi.js';
import type { PlayerModel } from '../models';
import { drawCoin } from './draw-coin';
import { COIN_SPACING, EMPTY_COIN_ALPHA, HEADING_STYLE, VALUE_STYLE } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface EventHudViewBindings {
    readonly model: PlayerModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A HUD that waits to be told. It listens for `'coins-changed'`, and then
 * redraws both the coins and the lives. It has no refresh step, so it shows
 * whatever it read when the event last arrived.
 *
 * This is the way an MVT view is never written. The listener runs in the
 * middle of the model's update, before the fifth coin turns into a life, so
 * it shows five coins and the old lives, which the game never settles on.
 */
export function EventHudView({ model }: EventHudViewBindings): Container {
    const view = new Container();
    view.addChild(new Text({ text: 'Told by an event', style: HEADING_STYLE }));

    const coins: Graphics[] = [];
    for (let i = 0; i < model.coinsPerLife; i++) {
        const coin = new Graphics();
        drawCoin(coin);
        coin.position.set(14 + i * COIN_SPACING, 58);
        coin.alpha = EMPTY_COIN_ALPHA;
        coins.push(coin);
        view.addChild(coin);
    }
    const livesText = new Text({ text: `Lives ${model.lives}`, y: 90, style: VALUE_STYLE });
    view.addChild(livesText);

    const stopListening = model.addListener('coins-changed', redrawHud);
    view.on('destroyed', stopListening);
    return view;

    function redrawHud(): void {
        for (let i = 0; i < coins.length; i++) coins[i].alpha = i < model.coins ? 1 : EMPTY_COIN_ALPHA;
        livesText.text = `Lives ${model.lives}`;
    }
}
