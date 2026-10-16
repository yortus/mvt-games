import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { PreviewView } from '../preview-view';
import { inBox } from './in-box';

htmlTest('waiting for a run', () => inBox(PreviewView({
    sandboxDocument: () => undefined,
    sandboxesStarted: () => 0,
    isPaused: () => false,
    steps: () => 0,
    speed: () => 1,
    isFocusTaken: () => true,
    placeholder: () => 'Press Run, or Ctrl+Enter, to run the project',
}), 480, 300));
