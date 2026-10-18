import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { THEME_KINDS } from '../../models';
import { ThemePickerView } from '../theme-picker-view';
import { THEME_CHOICES } from '../themes';

/** The picker in a strip of the site's nav, as the page puts it. */
function inNav(): HTMLElement {
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    const tools = document.createElement('div');
    tools.className = 'site-nav-tools';
    tools.append(ThemePickerView({ themes: THEME_CHOICES, theme: () => THEME_KINDS[0] }));
    nav.append(tools);
    return nav;
}

// Wider than the nav's fold (700px), so the menu shows, rather than its ◐
htmlTest('in the nav', { viewport: { width: 800, height: 56 } }, inNav);

htmlTest('in the nav, on a narrow screen', { viewport: { width: 360, height: 56 } }, inNav);
