import { Container } from 'pixi.js';
import type { BallModel } from '../models';
import { BallView } from './ball-view';
import { ClockView } from './clock-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: BallModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The game: the ball, and a clock of the game's own time. */
export function GameView({ model }: GameViewBindings): Container {
    const view = new Container();
    const clock = ClockView({ label: 'game time' });
    clock.position.set(16, 12);
    view.addChild(BallView({ model }), clock);
    return view;
}
