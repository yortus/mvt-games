import { Container, Graphics } from 'pixi.js';
import { createGlyphRow, GLYPH_HEIGHT, type PixelFont } from './pixel-font';
import { HEADING_COLOR, PANEL_COLOR, PANEL_DARK_COLOR, PANEL_LIGHT_COLOR, WELL_COLOR } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface PanelViewBindings {
    readonly font: PixelFont;
    /** Its size, in pixels. Read once. */
    readonly width: number;
    readonly height: number;
    /** The heading along its top. Read once. Empty for a panel with no heading and no well. */
    readonly heading: string;
}

/** Where a panel's well starts, below its heading, and how far in its lines are written. */
export const PANEL_WELL_Y = 14;
export const PANEL_LINE_X = 4;
export const PANEL_LINE_Y = PANEL_WELL_Y + 2;

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A panel, as the era's programs drew them: a slate face with a light top
 * and left edge and a dark bottom and right edge, so it stands out from
 * the screen. Under its heading is a sunken well, lit the other way, that
 * its lines sit in. It is drawn once and never changes.
 */
export function PanelView(bindings: PanelViewBindings): Container {
    const { font, width, height, heading } = bindings;
    const view = new Container();
    const face = new Graphics();
    drawBevel(face, 0, 0, width, height, PANEL_COLOR, PANEL_LIGHT_COLOR, PANEL_DARK_COLOR);
    if (heading !== '') drawBevel(face, 2, PANEL_WELL_Y, width - 4, height - PANEL_WELL_Y - 2, WELL_COLOR, PANEL_DARK_COLOR, PANEL_LIGHT_COLOR);
    view.addChild(face);
    if (heading !== '') {
        const title = createGlyphRow({ font, length: heading.length });
        title.write(heading, HEADING_COLOR, 0);
        title.container.position.set(PANEL_LINE_X, Math.floor((PANEL_WELL_Y - GLYPH_HEIGHT) / 2) + 1);
        view.addChild(title.container);
    }
    return view;
}

/**
 * Draws `view` into a texture of its own, in the screen's own pixels, and
 * from then on draws only that texture, scaled up as pixel art is. The view
 * calls `updateCacheTexture` in each refresh that writes to it, which draws
 * its glyphs again. So its hundreds of glyph sprites are drawn only when
 * they change, not every frame, which keeps each frame quick, even while
 * the window resizes.
 */
export function cacheAsPixels(view: Container): void {
    view.cacheAsTexture({ resolution: 1, scaleMode: 'nearest' });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A box filled with `color`, its top and left edges in `topLeft` and its bottom and right edges in `bottomRight`. */
function drawBevel(graphics: Graphics, x: number, y: number, width: number, height: number, color: number, topLeft: number, bottomRight: number): void {
    graphics.rect(x, y, width, height).fill(color);
    graphics.rect(x, y, width, 1).fill(topLeft);
    graphics.rect(x, y, 1, height).fill(topLeft);
    graphics.rect(x, y + height - 1, width, 1).fill(bottomRight);
    graphics.rect(x + width - 1, y, 1, height).fill(bottomRight);
}
