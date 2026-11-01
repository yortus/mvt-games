import { Container } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { PANEL_WIDTH, drawDoorPanel } from './draw-door-panel';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SnappingDoorViewBindings {
    readonly isOpen: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A door that shows the model's state and nothing more: there when it's
 * shut, and gone when it's open, from one frame to the next.
 */
export function SnappingDoorView(bindings: SnappingDoorViewBindings): Container {
    const view = new Container();
    const door = new Container();
    const right = drawDoorPanel('right');
    right.x = PANEL_WIDTH;
    door.addChild(drawDoorPanel('left'), right);
    view.addChild(door);

    function refresh(): void {
        door.visible = !bindings.isOpen();
    }

    setRefresh(view, refresh);
    return view;
}
