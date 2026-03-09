import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GhostViewBindings {
    getX(): number;
    getY(): number;
    getColor(): number;
    getTileSize(): number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGhostView(bindings: GhostViewBindings): Container {
    // ---- Change detection ---------------------------------------------------
    const watchColor = createWatch(bindings.getColor);
    const watchTileSize = createWatch(bindings.getTileSize);

    // ---- Scene elements -------------------------------------------------------
    const container = new Container();
    const gfx = new Graphics();
    container.addChild(gfx);

    updateLayout();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        if (watchColor.changed() | watchTileSize.changed()) updateLayout();

        const ts = bindings.getTileSize();
        const x = bindings.getX() * ts + ts / 2;
        const y = bindings.getY() * ts + ts / 2;
        container.position.set(x, y);
    }

    function updateLayout(): void {
        const ts = watchTileSize.value;
        const r = ts * 0.45;
        gfx.clear();

        // Body — semicircle top + rectangle bottom + wavy bottom edge
        gfx
            // top dome
            .arc(0, -r * 0.2, r, Math.PI, 0)
            // right side down
            .lineTo(r, r * 0.6)
            // wavy bottom
            .lineTo(r * 0.66, r * 0.35)
            .lineTo(r * 0.33, r * 0.6)
            .lineTo(0, r * 0.35)
            .lineTo(-r * 0.33, r * 0.6)
            .lineTo(-r * 0.66, r * 0.35)
            .lineTo(-r, r * 0.6)
            // left side up
            .lineTo(-r, -r * 0.2)
            .closePath()
            .fill(watchColor.value);

        // Eyes
        const eyeR = r * 0.2;
        const eyeY = -r * 0.25;
        gfx.circle(-r * 0.3, eyeY, eyeR).fill(0xffffff);
        gfx.circle(r * 0.3, eyeY, eyeR).fill(0xffffff);
        // Pupils
        const pupilR = eyeR * 0.5;
        gfx.circle(-r * 0.25, eyeY, pupilR).fill(0x0000aa);
        gfx.circle(r * 0.35, eyeY, pupilR).fill(0x0000aa);
    }
}
