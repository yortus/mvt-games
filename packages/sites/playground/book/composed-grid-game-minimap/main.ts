import { Text } from 'pixi.js';
import { definePixiProject } from 'playground';
import { createGameModel } from './models';
import { GameView, type GameViewPart, ToggleBarView } from './views';

const WIDTH = 640;
const HEIGHT = 360;

/** The child views the buttons show and hide, and the name on each one's button. */
const PARTS: readonly GameViewPart[] = ['walls', 'dots', 'spikes', 'ship', 'hud', 'minimap'];
const LABELS: readonly string[] = ['WallsView', 'DotsView', 'SpikesView', 'ShipView', 'HudView', 'MinimapView'];

// The project: a model of the game, and its top-level view, placed in the
// middle of the stage, with buttons to its left and a hint below it. The
// playground ticks what `start` returns, then updates and refreshes the views.
export const project = definePixiProject({
    width: WIDTH,
    height: HEIGHT,
    background: 0x0a0f24,
    start: ({ stage }) => {
        const model = createGameModel();

        // Which child views are hidden. That's presentation state: the game
        // plays the same whatever is hidden, so the model never hears of it.
        // It's kept here, beside the views, and the buttons change it.
        const hidden = new Set<GameViewPart>();

        const view = GameView({ model, isShown: (part) => !hidden.has(part) });
        view.position.set(95, 14);

        const toggles = ToggleBarView({
            labels: LABELS,
            isOnAt: (index) => !hidden.has(PARTS[index]),
            onToggled: (index) => {
                const part = PARTS[index];
                if (hidden.has(part)) hidden.delete(part);
                else hidden.add(part);
            },
        });
        toggles.position.set(2, 50);

        const hint = new Text({
            text: 'Arrow keys steer. Click a button, or press 1 to 6, to hide or show a view',
            anchor: 0.5,
            position: { x: WIDTH / 2, y: HEIGHT - 18 },
            style: { fontFamily: 'monospace', fontSize: 13, fill: 0x667799 },
        });
        stage.addChild(view, toggles, hint);
        return model;
    },
});
