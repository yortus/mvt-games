import { htmlTest } from 'v-snap';
import '../../arcade.css';
import type { HowToPlay } from '../../../entry-types';
import { HowToPlayView } from '../how-to-play-view';

/** A game's controls: keys, and touch, with a note under an action, keys pressed together, and on-screen buttons. */
const GAME: HowToPlay = {
    intro: 'Fly over the land, keep your fuel up, and destroy the base at the end of the run.',
    controls: [
        { action: 'Move', inputs: ['arrows', 'wasd', 'joystick'] },
        { action: 'Shoot', inputs: ['space', { button: 'Fire' }], note: 'Two shots in the air at most' },
        { action: 'Somersault', inputs: [['space', 'up', 'forward']] },
        { action: 'Restart', inputs: ['enter'] },
    ],
    notes: ['A rock that hits you costs a ship; you have 3.'],
};

/** A demo's controls, for the mouse and touch only, so the table has no keyboard column. */
const DEMO: HowToPlay = {
    intro: 'Choose a fractal from the panel.',
    controls: [
        { action: 'Move', inputs: ['drag'] },
        { action: 'Zoom', inputs: ['wheel', 'pinch', 'double-tap'] },
    ],
};

/** Returns the view in a panel the width of the info panel's page, on its background. */
function inPanel(howToPlay: HowToPlay): HTMLElement {
    const panel = document.createElement('div');
    panel.style.cssText = 'width:520px;padding:16px;background:#161b22;color:#c9d1d9;font-family:sans-serif;';
    panel.append(HowToPlayView({ howToPlay: () => howToPlay }));
    return panel;
}

htmlTest('a game, with keys and touch', () => inPanel(GAME));

htmlTest('a demo, with the mouse and touch only', () => inPanel(DEMO));
