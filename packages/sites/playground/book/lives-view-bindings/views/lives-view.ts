import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** The most lives the row has room for. */
const MAX_LIVES = 5;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface LivesViewBindings {
    readonly lives: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A row of ship icons, one for each life left. It asks one question, "how
 * many lives?", and doesn't know who answers it.
 */
export function LivesView(bindings: LivesViewBindings): Container {
    const view = new Container();
    const icons = createLifeIcons(view, MAX_LIVES);

    function refresh(): void {
        const lives = bindings.lives();
        for (let i = 0; i < icons.length; i++) icons[i].visible = i < lives;
    }

    setRefresh(view, refresh);
    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Adds a row of ship icons to the view, with a dim slot behind each, and returns the icons. */
function createLifeIcons(view: Container, count: number): Graphics[] {
    const icons: Graphics[] = [];
    for (let i = 0; i < count; i++) {
        const x = i * 36;
        view.addChild(new Graphics().circle(x, 0, 14).fill(0x1c2335));
        const icon = new Graphics().poly([x, -11, x - 9, 9, x, 4, x + 9, 9]).fill(0x44ffaa);
        view.addChild(icon);
        icons.push(icon);
    }
    return icons;
}
