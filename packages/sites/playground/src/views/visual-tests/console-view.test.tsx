import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import type { ConsoleEntry } from '../../models';
import { ConsoleView } from '../console-view';
import { inBox } from './in-box';

const ENTRIES: ConsoleEntry[] = [
    { level: 'log', text: 'Started' },
    { level: 'warn', text: 'A warning' },
    { level: 'error', text: 'thrown in update', location: { path: 'models/ball-model.ts', line: 30 } },
];

htmlTest('a log, a warning and an error with its place', () => inBox(ConsoleView({ entries: () => ENTRIES }), 480, 120));

htmlTest('empty', () => inBox(ConsoleView({ entries: () => [] }), 480, 60));
