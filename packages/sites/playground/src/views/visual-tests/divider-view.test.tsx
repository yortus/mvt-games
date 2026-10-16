import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { THEME_KINDS } from '../../models';
import { DividerView } from '../divider-view';
import { THEMES, writePalette } from '../themes';

/** Returns two panes side by side, or one above the other, with a divider between. */
function betweenPanes(orientation: 'vertical' | 'horizontal'): HTMLElement {
    const box = document.createElement('div');
    const isVertical = orientation === 'vertical';
    box.style.cssText = `display:grid;width:120px;height:80px;background:var(--pg-panel);grid-template-${isVertical ? 'columns' : 'rows'}:1fr 5px 1fr;`;
    writePalette(box, THEMES[THEME_KINDS[0]]);
    box.append(document.createElement('div'), DividerView({ orientation, label: 'Resize' }), document.createElement('div'));
    return box;
}

htmlTest('between two panes side by side', () => betweenPanes('vertical'));

htmlTest('between two panes one above the other', () => betweenPanes('horizontal'));
