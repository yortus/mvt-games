import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { THEME_KINDS } from '../../models';
import { SettingsView } from '../settings-view';
import { THEME_CHOICES } from '../../editor';

/** The settings in a strip of the site's nav, at its right, as the page puts them, with room below for the panel. */
function inNav(isOpen: boolean): HTMLElement {
    const page = document.createElement('div');
    page.style.width = '100vw';
    page.style.height = isOpen ? '260px' : '56px';
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.style.justifyContent = 'flex-end';
    const tools = document.createElement('div');
    tools.className = 'site-nav-tools';
    tools.append(SettingsView({
        themes: THEME_CHOICES,
        theme: () => THEME_KINDS[0],
        isRunOnChange: () => true,
        isOpen: () => isOpen,
    }));
    nav.append(tools);
    page.append(nav);
    return page;
}

// Wider than the nav's fold (820px), so the nav is laid out as on a desktop
htmlTest('in the nav', { viewport: { width: 900, height: 56 } }, () => inNav(false));

htmlTest('open', { viewport: { width: 900, height: 260 } }, () => inNav(true));

htmlTest('open, on a narrow screen', { viewport: { width: 360, height: 260 } }, () => inNav(true));
