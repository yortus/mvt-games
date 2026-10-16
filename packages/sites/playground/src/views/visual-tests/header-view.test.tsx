import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { HeaderView } from '../header-view';
import { inBox } from './in-box';

const EXAMPLES = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }];

htmlTest('a project open', () => inBox(HeaderView({
    projectName: () => 'Bouncing Ball',
    examples: EXAMPLES,
    shareLabel: () => 'Share',
    isSharing: () => false,
}), 900, 44));

htmlTest('sharing', () => inBox(HeaderView({
    projectName: () => 'Bouncing Ball',
    examples: EXAMPLES,
    shareLabel: () => 'Sharing...',
    isSharing: () => true,
}), 900, 44));
