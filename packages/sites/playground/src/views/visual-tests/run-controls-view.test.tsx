import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { RunControlsView } from '../run-controls-view';
import { inBox } from './in-box';

htmlTest('starting', () => inBox(RunControlsView({
    phase: () => 'starting',
    isPaused: () => false,
    speed: () => 1,
}), 480, 40));

htmlTest('running, paused by Step', () => inBox(RunControlsView({
    phase: () => 'running',
    isPaused: () => true,
    speed: () => 1,
}), 480, 40));

htmlTest('running slowly', () => inBox(RunControlsView({
    phase: () => 'running',
    isPaused: () => false,
    speed: () => 0.25,
}), 480, 40));

htmlTest('stopped by an error', () => inBox(RunControlsView({
    phase: () => 'failed',
    isPaused: () => false,
    speed: () => 1,
}), 480, 40));
