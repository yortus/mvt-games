import type { GrainKind } from './grain-grid';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * The colour of a grain. Each grain gets one of a few shades of its kind's
 * colour, picked from its id, so a pile looks grainy rather than flat. The id
 * is stable for the grain's life, so its shade never flickers.
 *
 * Presentation only: the model knows kinds, never colours.
 */
export function pickGrainTint(kind: GrainKind, id: number): number {
    // Multiplicative hash, top three bits: neighbouring ids get unrelated shades.
    const shade = Math.imul(id, 0x9e3779b1) >>> (32 - SHADE_BITS);
    switch (kind) {
        case 'sand': return SAND_SHADES[shade];
        case 'water': return WATER_SHADES[shade];
        case 'wall': return WALL_SHADES[shade];
    }
}

/** A grain colour by shade index, for drawing samples of a kind. */
export function lookUpShade(kind: GrainKind, shade: number): number {
    const shades = kind === 'sand' ? SAND_SHADES : kind === 'water' ? WATER_SHADES : WALL_SHADES;
    return shades[shade % SHADE_COUNT];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const SHADE_BITS = 3;
const SHADE_COUNT = 1 << SHADE_BITS;

/** Shades of a base colour, from a little darker to a little lighter. */
function makeShades(base: number, spread: number): readonly number[] {
    const shades: number[] = [];
    for (let i = 0; i < SHADE_COUNT; i++) {
        const factor = 1 + spread * (i / (SHADE_COUNT - 1) - 0.5);
        shades.push(scaleColor(base, factor));
    }
    return shades;
}

function scaleColor(color: number, factor: number): number {
    const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.round((color & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
}

const SAND_SHADES = makeShades(0xdcb86a, 0.28);
const WATER_SHADES = makeShades(0x3d8fe0, 0.18);
const WALL_SHADES = makeShades(0x7c8496, 0.2);
