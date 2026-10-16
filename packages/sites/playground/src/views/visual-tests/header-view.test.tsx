import { advanceTime } from '@mvtjs/html';
import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { EDITOR_THEME_KINDS } from '../../models';
import { HeaderView, type HeaderViewBindings } from '../header-view';
import { inBox } from './in-box';

const BASE: HeaderViewBindings = {
    projectName: () => 'Bouncing Ball',
    examples: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }],
    shareLabel: () => 'Share',
    isSharing: () => false,
    saves: () => 0,
    themes: EDITOR_THEME_KINDS.map((kind) => ({ kind, name: kind })),
    theme: () => EDITOR_THEME_KINDS[0],
};

htmlTest('a project open', () => inBox(HeaderView(BASE), 900, 44));

htmlTest('sharing', () => inBox(HeaderView({ ...BASE, shareLabel: () => 'Sharing...', isSharing: () => true }), 900, 44));

htmlTest('just saved', async () => {
    let saves = 0;
    const view = HeaderView({ ...BASE, saves: () => saves });
    saves++;
    await advanceTime(100, view);
    return inBox(view, 900, 44);
});
