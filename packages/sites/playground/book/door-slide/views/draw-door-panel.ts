import { Graphics } from 'pixi.js';

/** The size of the doorway, in pixels. */
export const DOOR_WIDTH = 120;
export const DOOR_HEIGHT = 150;

/** The width of each of the door's two halves, in pixels. */
export const PANEL_WIDTH = DOOR_WIDTH / 2;

/** Which half of the door a panel is. */
export type DoorPanelSide = 'left' | 'right';

/**
 * Returns one half of a spaceship's sliding door: a steel panel, with
 * hazard stripes down the edge where it meets the other half. Its top left
 * corner is at its origin.
 */
export function drawDoorPanel(side: DoorPanelSide): Graphics {
    const panel = new Graphics();

    // The steel plate, with a darker plate set into it, and two ribs across
    panel.rect(0, 0, PANEL_WIDTH, DOOR_HEIGHT).fill(STEEL);
    panel.rect(6, 8, PANEL_WIDTH - 12, DOOR_HEIGHT - 16).fill(STEEL_DARK);
    panel.rect(0, 36, PANEL_WIDTH, 6).fill(RIB);
    panel.rect(0, DOOR_HEIGHT - 42, PANEL_WIDTH, 6).fill(RIB);

    // The hazard stripes. They slant away from the middle on both halves,
    // so that they make chevrons while the door is shut.
    const innerX = side === 'left' ? PANEL_WIDTH : 0;
    const outerX = side === 'left' ? PANEL_WIDTH - STRIPE_BAND : STRIPE_BAND;
    panel.rect(Math.min(innerX, outerX), 0, STRIPE_BAND, DOOR_HEIGHT).fill(HAZARD_YELLOW);
    for (let y = 4; y + STRIPE_BAND + STRIPE_THICKNESS <= DOOR_HEIGHT - 4; y += STRIPE_THICKNESS * 2) {
        panel
            .poly([
                innerX, y,
                outerX, y + STRIPE_BAND,
                outerX, y + STRIPE_BAND + STRIPE_THICKNESS,
                innerX, y + STRIPE_THICKNESS,
            ])
            .fill(HAZARD_BLACK);
    }

    return panel;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const STEEL = 0x8d96a8;
const STEEL_DARK = 0x737c8f;
const RIB = 0x596273;
const HAZARD_YELLOW = 0xf2c230;
const HAZARD_BLACK = 0x1d1f24;

/** How wide the band of hazard stripes is, in pixels. */
const STRIPE_BAND = 12;
/** How thick each hazard stripe is, in pixels. */
const STRIPE_THICKNESS = 7;
