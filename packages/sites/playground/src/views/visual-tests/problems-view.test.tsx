import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import type { Problem } from '../../runtime';
import { ProblemsView } from '../problems-view';
import { inBox } from './in-box';

const PROBLEMS: Problem[] = [
    { path: 'main.ts', line: 12, message: 'Unexpected token' },
    { path: 'views/ball-view.ts', message: 'Cannot find \'./ball\', imported from views/ball-view.ts.' },
];

htmlTest('two problems', () => inBox(ProblemsView({ problems: () => PROBLEMS }), 480, 100));

htmlTest('none', () => inBox(ProblemsView({ problems: () => [] }), 480, 60));
