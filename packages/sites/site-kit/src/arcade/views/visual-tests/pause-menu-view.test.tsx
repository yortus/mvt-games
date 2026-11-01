import { htmlTest } from 'v-snap';
import '../../arcade.css';
import { PauseMenuView } from '../pause-menu-view';

/** The menu, open. It is fixed over the whole viewport, below where the runner's bar would be, so the image is the viewport. */
function open(musicVolume: number): Element {
    return PauseMenuView({
        isOpen: () => true,
        heading: () => 'GAME PAUSED',
        musicVolume: () => musicVolume,
        sfxVolume: () => 0.5,
    });
}

htmlTest('open', { viewport: { width: 480, height: 420 }, width: 480, height: 420 }, () => open(0.7));

htmlTest('open on a phone, with the music off', { viewport: { width: 360, height: 420 }, width: 360, height: 420 }, () => open(0));
