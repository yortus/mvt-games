// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns a view in a box of a fixed size, on the page's background, as the
 * layout gives it room in the page. Many of the playground's views fill
 * their pane, so they need a size to fill.
 */
export function inBox(view: Element, width: number, height: number): HTMLElement {
    const box = document.createElement('div');
    box.style.cssText = `width:${width}px;height:${height}px;display:flex;flex-direction:column;background:#0d1117;`;
    // The view fills the box, as its pane would make it
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
    wrapper.append(view);
    if (view instanceof HTMLElement) view.style.flex = '1';
    box.append(wrapper);
    return box;
}
