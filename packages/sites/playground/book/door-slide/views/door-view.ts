import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { DOOR_HEIGHT, DOOR_WIDTH, PANEL_WIDTH, drawDoorPanel } from './draw-door-panel';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the door takes to slide open or shut, in ms. */
const SLIDE_MS = 500;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface DoorViewBindings {
    readonly isOpen: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A door whose two halves slide apart into the walls as it opens, and back
 * together as it shuts, over SLIDE_MS. How far open it is on screen is
 * presentation state: the model's door is already open, so nothing in the
 * game depends on it.
 */
export function DoorView(bindings: DoorViewBindings): Container {
    const view = new Container();
    const left = drawDoorPanel('left');
    const right = drawDoorPanel('right');
    const panels = new Container();
    panels.addChild(left, right);
    // The doorway's shape, which hides each half as it slides into the wall
    const doorway = new Graphics().rect(0, 0, DOOR_WIDTH, DOOR_HEIGHT).fill(0xffffff);
    panels.mask = doorway;
    view.addChild(panels, doorway);

    // Presentation state: how far open the door is on screen, from 0 (shut) to 1 (open)
    let openness = bindings.isOpen() ? 1 : 0;

    function update(deltaMs: number): void {
        const target = bindings.isOpen() ? 1 : 0;
        const step = deltaMs / SLIDE_MS;
        if (openness < target) openness = Math.min(target, openness + step);
        if (openness > target) openness = Math.max(target, openness - step);
    }

    function refresh(): void {
        // Each half slides its own width into the wall on its side
        const slide = openness * PANEL_WIDTH;
        left.x = -slide;
        right.x = PANEL_WIDTH + slide;
    }

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;
}
