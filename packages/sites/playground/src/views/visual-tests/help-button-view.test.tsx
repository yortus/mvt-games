import { htmlTest } from 'v-snap';
import '../../nav.css';
import '../../playground.css';
import { HelpButtonView } from '../help-button-view';

/** The button at the end of a strip of the site's nav, as the page puts it. */
function inNav(isOpen: boolean): HTMLElement {
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    const end = document.createElement('div');
    end.className = 'site-nav-end';
    end.append(HelpButtonView({ isOpen: () => isOpen }));
    nav.append(end);
    return nav;
}

const SIZE = { viewport: { width: 120, height: 56 } };

htmlTest('in the nav', SIZE, () => inNav(false));

htmlTest('in the nav, with the Help open', SIZE, () => inNav(true));
