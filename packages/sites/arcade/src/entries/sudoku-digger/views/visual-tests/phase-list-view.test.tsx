import { canvasTest } from 'v-snap';
import { PhaseListView } from '../phase-list-view';

const SIZE = { width: 160, height: 116, pixelArt: false };
const NAMES = ['Try', 'Seed', 'Fill', 'Dig', 'Shuffle', 'Grade'];

canvasTest('at the start', SIZE, () => PhaseListView({ names: NAMES, current: () => 0 }));
canvasTest('half way through', SIZE, () => PhaseListView({ names: NAMES, current: () => 3 }));
canvasTest('all done', SIZE, () => PhaseListView({ names: NAMES, current: () => NAMES.length }));
