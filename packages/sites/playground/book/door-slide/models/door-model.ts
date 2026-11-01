// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How long the door stays open, or shut, before it changes on its own, in ms. */
const CHANGE_EVERY_MS = 2000;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A door on a spaceship, which opens and shuts on its own every so often. The
 * player can open or shut it sooner, and the wait starts again. The door is
 * open or shut, and nothing in between: that's all the game needs.
 */
export interface DoorModel {
    readonly isOpen: boolean;
    readonly open: () => void;
    readonly close: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a shut door. */
export function createDoorModel(): DoorModel {
    let isOpen = false;
    let elapsedMs = 0;

    const model: DoorModel = {
        get isOpen() { return isOpen; },

        open() {
            isOpen = true;
            elapsedMs = 0;
        },

        close() {
            isOpen = false;
            elapsedMs = 0;
        },

        update(deltaMs) {
            elapsedMs += deltaMs;
            if (elapsedMs >= CHANGE_EVERY_MS) {
                elapsedMs -= CHANGE_EVERY_MS;
                isOpen = !isOpen;
            }
        },
    };

    return model;
}
