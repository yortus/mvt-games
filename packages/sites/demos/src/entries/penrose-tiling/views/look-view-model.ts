import type { TileSet } from '../models';
import { COLOR_MODES, type ColorMode } from './color-mode';
import { PALETTE_NAMES, type PaletteName } from './palette-name';
import { DEFAULT_GAP, DEFAULT_GRID_REVEAL, MAX_FLOW_SPEED } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * How the tiling looks. The tiling says which tiles there are and where. All
 * of this is presentation, so it lives with the views: the colours they are
 * drawn in, and how far they have drawn back toward the grids that lay them.
 *
 * One control, `gridReveal`, runs from the tiles to the grids. At one end the
 * tiles touch, with no gaps. At the other, each has drawn back to the
 * crossing of two lines that it comes from and shrunk away, and only the
 * lines are left.
 */
export interface LookViewModel {
    /** The palette the tiles are coloured from. */
    palette: PaletteName;
    /** What decides each tile's colour. */
    colorMode: ColorMode;
    /** Where on the palette the colours start, from 0 to 1. Flowing moves it on, and round. */
    colorOffset: number;
    /** How fast the colours flow while the tiling drifts, in whole palettes per second, up to `MAX_FLOW_SPEED`. */
    flowSpeed: number;
    /**
     * The one control from the tiles to their grids, from 0 to 1. At 0 the
     * tiles touch. Up to `DEFAULT_GRID_REVEAL`, gaps open between them. Past
     * it, they draw back to their crossings, and at 1 only the lines are left.
     */
    gridReveal: number;
    /** The gap between neighbouring tiles, in tile edges. It follows `gridReveal`. */
    readonly gap: number;
    /**
     * How far the tiles have drawn back to their crossings, from 0, where
     * they lie in the tiling, to 1, where they have shrunk away. It follows
     * `gridReveal`.
     */
    readonly drawBack: number;
    /** Glides up to the grids alone, or back down to `DEFAULT_GRID_REVEAL`. */
    toggleGrids: () => void;
    /** Chooses a new look at random: a palette, a colour mode and a starting colour. */
    pickRandomLook: () => void;
    /** The tile drawn nearest the point (`x`, `y`) of the tiling, part of the way back to its crossing, or -1 if there are none. */
    findDrawnTile: (x: number, y: number) => number;
    /** Moves the colours and the grids on by `deltaMs`. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a {@link LookViewModel}. */
export interface LookViewModelOptions {
    /** The tiles being drawn. */
    tiles: () => TileSet;
    /** Whether the tiling is drifting, which sets the colours flowing. */
    isDrifting: () => boolean;
    /** Gives a random number from 0 up to, but not including, 1. Defaults to `Math.random`. */
    random?: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the starting look: rings of the sunset palette, with narrow gaps between the tiles. */
export function createLookViewModel(options: LookViewModelOptions): LookViewModel {
    const random = options.random ?? Math.random;

    let palette: PaletteName = PALETTE_NAMES[0];
    let colorMode: ColorMode = DEFAULT_COLOR_MODE;
    let colorOffset = 0;
    let flowSpeed = DEFAULT_FLOW_SPEED;
    let gridReveal = DEFAULT_GRID_REVEAL;
    // Which way the reveal is gliding: 1 to the grids, -1 to the tiling, and 0 not at all
    let gridGlide = 0;

    return {
        get palette() { return palette; },
        set palette(value) { palette = value; },
        get colorMode() { return colorMode; },
        set colorMode(value) { colorMode = value; },
        get colorOffset() { return colorOffset; },
        set colorOffset(value) { colorOffset = wrapUnit(value); },
        get flowSpeed() { return flowSpeed; },
        set flowSpeed(value) { flowSpeed = clamp(value, 0, MAX_FLOW_SPEED); },

        get gridReveal() { return gridReveal; },
        set gridReveal(value) {
            gridReveal = clamp(value, 0, 1);
            gridGlide = 0;
        },
        get gap() { return DEFAULT_GAP * Math.min(1, gridReveal / DEFAULT_GRID_REVEAL); },
        get drawBack() { return measureDrawBack(); },

        toggleGrids() {
            const isHeadingToGrids = gridGlide === 0 ? gridReveal >= 0.5 : gridGlide > 0;
            gridGlide = isHeadingToGrids ? -1 : 1;
        },

        pickRandomLook() {
            palette = pickOther(PALETTE_NAMES, palette);
            colorMode = pickOther(COLOR_MODES, colorMode);
            colorOffset = random();
        },

        findDrawnTile,

        update(deltaMs) {
            const seconds = deltaMs / 1000;
            if (options.isDrifting()) colorOffset = wrapUnit(colorOffset + flowSpeed * seconds);
            glideGrids(seconds);
        },
    };

    /** Moves the reveal on, if it is gliding: up to the grids alone, or down to where it starts. */
    function glideGrids(seconds: number): void {
        if (gridGlide === 0) return;
        const target = gridGlide > 0 ? 1 : DEFAULT_GRID_REVEAL;
        const step = seconds / GRID_GLIDE_SECONDS;
        gridReveal = gridGlide > 0 ? Math.min(target, gridReveal + step) : Math.max(target, gridReveal - step);
        if (gridReveal === target) gridGlide = 0;
    }

    /** How far past where it starts the reveal is, as a share of the way to the end. */
    function measureDrawBack(): number {
        return Math.max(0, (gridReveal - DEFAULT_GRID_REVEAL) / (1 - DEFAULT_GRID_REVEAL));
    }

    function findDrawnTile(x: number, y: number): number {
        const { count, cornerXs, cornerYs, crossingXs, crossingYs } = options.tiles();
        const drawBack = measureDrawBack();
        let nearest = -1;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < count; i++) {
            const middleX = (cornerXs[i * 4] + cornerXs[i * 4 + 2]) * 0.5;
            const middleY = (cornerYs[i * 4] + cornerYs[i * 4 + 2]) * 0.5;
            const drawnX = middleX + (crossingXs[i] - middleX) * drawBack;
            const drawnY = middleY + (crossingYs[i] - middleY) * drawBack;
            const distance = (drawnX - x) ** 2 + (drawnY - y) ** 2;
            if (distance >= nearestDistance) continue;
            nearestDistance = distance;
            nearest = i;
        }
        return nearest;
    }

    /** One of `choices` at random, other than `current`. */
    function pickOther<T>(choices: readonly T[], current: T): T {
        const index = choices.indexOf(current);
        const offset = 1 + Math.min(choices.length - 2, Math.floor(random() * (choices.length - 1)));
        return choices[(index + offset) % choices.length];
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Rings flow outward from the middle as the colours drift, which draws the eye in. */
const DEFAULT_COLOR_MODE: ColorMode = 'rings';
const DEFAULT_FLOW_SPEED = 0.03;

/** How long a glide across the whole of the reveal would take, in seconds. */
const GRID_GLIDE_SECONDS = 1.2;

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

/** `value`, brought round into the range from 0 up to, but not including, 1. */
function wrapUnit(value: number): number {
    return value - Math.floor(value);
}
