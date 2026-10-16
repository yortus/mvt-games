import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import type { ListedProblem } from '../../models';
import { ProblemsView } from '../problems-view';
import { inBox } from './in-box';

const PROBLEMS: ListedProblem[] = [
    { path: 'main.ts', line: 12, message: 'Unexpected token', severity: 'error', isBlocking: true },
    { path: 'views/ball-view.ts', message: 'Cannot find \'./ball\', imported from views/ball-view.ts.', severity: 'error', isBlocking: true },
    { path: 'models/ball-model.ts', line: 8, column: 5, message: 'Property \'speed\' does not exist on type \'BallModel\'.', severity: 'error', isBlocking: false },
    { path: 'models/ball-model.ts', line: 20, column: 9, message: '\'unused\' is declared but never read.', severity: 'warning', isBlocking: false },
];

htmlTest('problems of each kind', () => inBox(ProblemsView({ problems: () => PROBLEMS }), 520, 130));

htmlTest('none', () => inBox(ProblemsView({ problems: () => [] }), 480, 60));
