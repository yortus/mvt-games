import { Container, Rectangle, Text } from 'pixi.js';
import type { Audio80 } from 'audio90';
import type { ShipModel } from '../models';
import { ShipView } from './ship-view';
import { ShotReactionsView } from './shot-reactions-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: ShipModel;
    /** The sound chip for sound effects. */
    readonly sfx: Audio80;
    /** The size of the play area, which takes clicks. Read once. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ship and its bullets on the left, and the two reactions on the right.
 * Click, or press Space, to fire.
 */
export function GameView({ model, sfx, width, height }: GameViewBindings): Container {
    const view = new Container();

    const ship = ShipView({ x: model.x, y: model.y, bullets: () => model.bullets });
    const reactions = ShotReactionsView({ phase: () => model.phase, shotsFired: () => model.shotsFired, sfx });
    reactions.position.set(230, 30);
    const hint = new Text({ text: 'click, or press Space, to fire', style: { fontFamily: 'monospace', fontSize: 14, fill: 0x55607a } });
    hint.position.set(230, 260);
    view.addChild(ship, reactions, hint);

    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, width, height);
    view.on('pointerdown', () => model.fire());
    window.addEventListener('keydown', onKeyDown);
    view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));

    return view;

    function onKeyDown(e: KeyboardEvent): void {
        if (e.key !== ' ' || e.repeat) return;
        // Stops Space scrolling the page
        e.preventDefault();
        model.fire();
    }
}
