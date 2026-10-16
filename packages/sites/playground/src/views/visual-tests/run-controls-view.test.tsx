import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { RunControlsView } from '../run-controls-view';
import { inBox } from './in-box';

htmlTest('not run yet', () => inBox(RunControlsView({
    phase: () => 'idle',
    isPaused: () => false,
    speed: () => 1,
    isRunOnChange: () => true,
}), 480, 40));

htmlTest('running, paused, at half speed', () => inBox(RunControlsView({
    phase: () => 'running',
    isPaused: () => true,
    speed: () => 0.5,
    isRunOnChange: () => false,
}), 480, 40));
