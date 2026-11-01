import { htmlTest } from 'v-snap';
import '../../arcade.css';
import type { DeviceKind } from '../../../device';
import type { HowToPlay } from '../../../entry-types';
import { HowToPlayView } from '../how-to-play-view';
import { wearTheme } from './wear-theme.test-support';

/**
 * A game's controls: keys, and touch, with a note under an action, a note for
 * touch only, keys pressed together, on-screen buttons, and actions for one
 * kind of device only.
 */
const GAME: HowToPlay = {
    intro: 'Fly over the land, keep your fuel up, and destroy the base at the end of the run.',
    controls: [
        { action: 'Move', inputs: ['arrows', 'wasd'], touchInputs: ['joystick'] },
        {
            action: 'Shoot',
            inputs: ['space'],
            touchInputs: [{ button: 'Fire' }],
            note: 'Two shots in the air at most',
            touchNote: 'A finger held down fires too',
        },
        { action: 'Somersault', inputs: [['space', 'up', 'forward']], touchInputs: [[{ button: 'Atk' }, 'up', 'forward']] },
        { action: 'Stop', touchInputs: ['tap'] },
        { action: 'Restart', inputs: ['enter'] },
    ],
    notes: ['A rock that hits you costs a ship; you have 3.'],
};

/** A demo's controls, for the mouse and touch only, so the table has no keyboard column, and one for the mouse only. */
const DEMO: HowToPlay = {
    intro: 'Choose a fractal from the panel.',
    controls: [
        { action: 'Move', inputs: ['drag'] },
        { action: 'Zoom', inputs: ['wheel', 'pinch', 'double-tap'] },
        { action: 'Recentre', inputs: ['click'] },
    ],
};

/** Returns the view, as a device of `deviceKind` shows it, in a panel the width of the info panel's page, on its background. */
function inPanel(howToPlay: HowToPlay, deviceKind: DeviceKind): HTMLElement {
    const panel = document.createElement('div');
    // On the panel's surface, in whatever theme the page wears
    panel.style.cssText = 'width:520px;padding:16px;background:var(--theme-surface);color:var(--theme-text);font-family:sans-serif;';
    panel.append(HowToPlayView({ howToPlay: () => howToPlay, deviceKind }));
    return panel;
}

htmlTest('a game, on a desktop, with keys only', () => inPanel(GAME, 'desktop'));

htmlTest('a game, on a phone, with touch only', () => inPanel(GAME, 'handheld'));

htmlTest('a game, on a laptop with a touch screen, with keys and touch', () => inPanel(GAME, 'touch-desktop'));

htmlTest('a demo, on a desktop, with the mouse', () => inPanel(DEMO, 'desktop'));

htmlTest('a demo, on a phone, with touch only', () => inPanel(DEMO, 'handheld'));

htmlTest('a game, on a desktop, with keys only, in the Dark theme', () => {
    wearTheme('dark');
    return inPanel(GAME, 'desktop');
});

htmlTest('a game, on a desktop, with keys only, in the Light theme', () => {
    wearTheme('light');
    return inPanel(GAME, 'desktop');
});
