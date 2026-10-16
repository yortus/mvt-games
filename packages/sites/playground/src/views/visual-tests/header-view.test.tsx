import { advanceTime } from '@mvtjs/html';
import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { HeaderView, type HeaderViewBindings } from '../header-view';
import { inBox } from './in-box';

const BASE: HeaderViewBindings = {
    projectName: () => 'Bouncing Ball',
    saves: () => 0,
};

htmlTest('a project open', () => inBox(HeaderView(BASE), 900, 44));

htmlTest('just saved', async () => {
    let saves = 0;
    const view = HeaderView({ ...BASE, saves: () => saves });
    saves++;
    await advanceTime(100, view);
    return inBox(view, 900, 44);
});
