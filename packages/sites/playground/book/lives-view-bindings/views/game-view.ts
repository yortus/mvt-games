import { Container, Text } from 'pixi.js';
import type { GameModel } from '../models';
import { LivesView } from './lives-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: GameModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Three rows of lives, all drawn by the same LivesView. Each row's wiring
 * answers the view's one question in its own way.
 */
export function GameView({ model }: GameViewBindings): Container {
    const view = new Container();

    // The same view, three times. Only the wiring differs.
    addRow(0, 'player one', LivesView({ lives: () => model.ship.lives }));
    addRow(1, 'player two', LivesView({ lives: () => model.player2.lives }));
    addRow(2, 'a test', LivesView({ lives: () => 2 }));

    return view;

    function addRow(index: number, name: string, lives: Container): void {
        const y = 60 + index * 90;
        const nameText = new Text({ text: name, style: { fontFamily: 'monospace', fontSize: 20, fill: 0xffffff } });
        nameText.anchor.set(0, 0.5);
        nameText.position.set(100, y);
        lives.position.set(380, y);
        view.addChild(nameText, lives);
    }
}
