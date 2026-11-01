import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { THEME_KINDS } from '../../models';
import { PALETTES, writePalette } from '../../palettes';
import { PreviewView } from '../preview-view';

htmlTest('waiting for a run', () => inBox(PreviewView({
    sandboxDocument: () => undefined,
    sandboxesStarted: () => 0,
    isPaused: () => false,
    steps: () => 0,
    speed: () => 1,
    background: () => PALETTES[THEME_KINDS[0]].palette.background,
    isFocusTaken: () => true,
    placeholder: () => 'Press Normal, or Ctrl+Enter, to run the project',
}), 480, 300));

/**
 * Returns the view in a box of a fixed size, in the default theme's colours,
 * as the page's layout gives it room. The preview fills its pane, so it needs
 * a size to fill.
 */
function inBox(view: Element, width: number, height: number): HTMLElement {
    const box = document.createElement('div');
    box.style.cssText = `width:${width}px;height:${height}px;display:flex;flex-direction:column;`;
    writePalette(box, PALETTES[THEME_KINDS[0]]);
    if (view instanceof HTMLElement) view.style.flex = '1';
    box.append(view);
    return box;
}
