import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { THEME_KINDS } from '../../models';
import { PreviewView } from '../preview-view';
import { THEMES } from '../themes';
import { inBox } from './in-box';

htmlTest('waiting for a run', () => inBox(PreviewView({
    sandboxDocument: () => undefined,
    sandboxesStarted: () => 0,
    isPaused: () => false,
    steps: () => 0,
    speed: () => 1,
    background: () => THEMES[THEME_KINDS[0]].palette.background,
    isFocusTaken: () => true,
    placeholder: () => 'Press Run, or Ctrl+Enter, to run the project',
}), 480, 300));
