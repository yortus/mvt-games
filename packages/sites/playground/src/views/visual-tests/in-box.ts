import { THEME_KINDS, type ThemeKind } from '../../models';
import { THEMES, writePalette } from '../themes';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns a view in a box of a fixed size, on the page's background, as the
 * layout gives it room in the page. Many of the playground's views fill
 * their pane, so they need a size to fill. The box has a theme's colours,
 * the default's unless another is given, as the page has them.
 */
export function inBox(view: Element, width: number, height: number, theme: ThemeKind = THEME_KINDS[0]): HTMLElement {
    const box = document.createElement('div');
    box.style.cssText = `width:${width}px;height:${height}px;display:flex;flex-direction:column;background:var(--pg-panel);color:var(--pg-text);`;
    writePalette(box, THEMES[theme]);
    // The view fills the box, as its pane would make it
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
    wrapper.append(view);
    if (view instanceof HTMLElement) view.style.flex = '1';
    box.append(wrapper);
    return box;
}
