import { Container, Graphics } from 'pixi.js';
import { GROUND_Y_PX } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ArenaViewBindings {
    /** Size of the arena in pixels. Read once: the arena is drawn once. */
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The dojo behind the fighters: paper screens between wooden posts, a
 * wainscot, and a plank floor from the ground line down. Drawn once.
 */
export function ArenaView(bindings: ArenaViewBindings): Container {
    const { width, height } = bindings;
    const view = new Container();
    view.label = 'arena';

    const g = new Graphics();
    view.addChild(g);

    // Paper screens, with their lattice
    g.rect(0, 0, width, GROUND_Y_PX).fill(PAPER_COLOR);
    for (let x = LATTICE_X; x < width; x += LATTICE_X) {
        g.rect(x, BEAM_HEIGHT, 1, WAINSCOT_TOP - BEAM_HEIGHT).fill(LATTICE_COLOR);
    }
    for (let y = BEAM_HEIGHT + LATTICE_Y; y < WAINSCOT_TOP; y += LATTICE_Y) {
        g.rect(0, y, width, 1).fill(LATTICE_COLOR);
    }

    // Beam, posts and wainscot
    g.rect(0, 0, width, BEAM_HEIGHT).fill(DARK_WOOD_COLOR);
    for (let x = 0; x <= width; x += POST_SPACING) {
        g.rect(x - POST_WIDTH / 2, 0, POST_WIDTH, GROUND_Y_PX).fill(POST_COLOR);
    }
    g.rect(0, WAINSCOT_TOP, width, GROUND_Y_PX - WAINSCOT_TOP).fill(WOOD_COLOR);
    g.rect(0, WAINSCOT_TOP, width, 2).fill(DARK_WOOD_COLOR);

    // Floor, with plank seams spreading toward the viewer
    g.rect(0, GROUND_Y_PX, width, height - GROUND_Y_PX).fill(FLOOR_COLOR);
    g.rect(0, GROUND_Y_PX, width, 2).fill(DARK_WOOD_COLOR);
    let gap = 8;
    for (let y = GROUND_Y_PX + gap; y < height; y += gap) {
        g.rect(0, y, width, 1).fill(FLOOR_SEAM_COLOR);
        gap += 4;
    }

    return view;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BEAM_HEIGHT = 14;
const WAINSCOT_TOP = GROUND_Y_PX - 30;
const POST_SPACING = 96;
const POST_WIDTH = 8;
const LATTICE_X = 24;
const LATTICE_Y = 29;

const PAPER_COLOR = 0xe6dcc0;
const LATTICE_COLOR = 0xb8a682;
const DARK_WOOD_COLOR = 0x4e3421;
const POST_COLOR = 0x5e4029;
const WOOD_COLOR = 0x7a5636;
const FLOOR_COLOR = 0xa8743f;
const FLOOR_SEAM_COLOR = 0x8c5e30;
