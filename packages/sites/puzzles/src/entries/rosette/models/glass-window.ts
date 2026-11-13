import type { LevelSettings } from './levels';
import { paintGradient } from './paint-gradient';
import { createRandom, type Random } from './random';
import { createTilePatch, type TilePatch } from './tile-patch';
import type { FrameKind } from './trace-frame';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * A puzzle as it is made: a window of tiles cut to its frame, the colour
 * each tile's piece has, which pieces are locked, and how the rest are
 * jumbled. A piece is
 * numbered for the tile it belongs on, so piece `t` is solved on tile `t`.
 * A piece only ever sits on a tile of its own shape, as glass would.
 */
export interface GlassWindow {
    readonly patch: TilePatch;
    /** The colour of each piece, as 0xRRGGBB. */
    readonly colours: readonly number[];
    /**
     * Whether each piece is locked from the start, on its own tile, never to
     * move: the frame's pieces, and any piece left alone in
     * its shape. More lock as the window is mended.
     */
    readonly locked: Readonly<Uint8Array>;
    /** The piece each tile starts with. Every piece that isn't locked starts off its own tile, on one of its shape. */
    readonly jumble: Readonly<Uint16Array>;
    /** The fewest swaps that solve the jumble. */
    readonly fewestSwaps: number;
    /** How different the two most alike pieces look, in OKLab. */
    readonly closestPair: number;
    /** The puzzle written out short, so that a save made for another puzzle is never taken for this one's. */
    readonly description: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GlassWindowOptions {
    /** Any whole number. The same seed and settings always make the same puzzle. */
    readonly seed: number;
    readonly settings: LevelSettings;
    /** The window's frame. */
    readonly frame: FrameKind;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a puzzle from a seed. It draws a tiling, cuts it to the frame,
 * and paints a gradient over it, and draws again if
 * the gradient can't be made subtle enough without leaving what a screen can
 * show, which is rare. Then it locks the frame's pieces, which hold the
 * gradient's whole rim: that shows which colours run where, and stops the
 * picture being solved as its mirror image. It jumbles the rest, each among
 * the pieces of its own shape. A shape left
 * with only one free piece can't be jumbled, so that piece is locked too.
 */
export function createGlassWindow(options: GlassWindowOptions): GlassWindow {
    const { seed, settings, frame } = options;
    const random = createRandom({ seed });
    for (let attempt = 0; ; attempt++) {
        const symmetry = settings.symmetries[Math.floor(random.next() * settings.symmetries.length)];
        const patch = createTilePatch({
            symmetry,
            frame,
            glass: settings.tiles,
            shift: Math.floor(random.next() * 1024) / 1024,
            centreX: Math.floor(random.next() * 64) / 64 - 0.5,
            centreY: Math.floor(random.next() * 64) / 64 - 0.5,
            rotation: (Math.floor(random.next() * 360) * Math.PI) / 180,
        });
        const gradient = paintGradient({ patch, random, closestPair: settings.closestPair });
        if (gradient === undefined) {
            if (attempt >= MOST_ATTEMPTS) throw new Error(`glass window: no gradient fits after ${MOST_ATTEMPTS} tries, for seed ${seed}`);
            continue;
        }
        const locked = Uint8Array.from(patch.cuts);
        lockLoneShapes(patch, locked);
        const jumble = jumblePieces(patch, locked, random);
        return {
            patch,
            colours: gradient.colours,
            locked,
            jumble,
            fewestSwaps: countFewestSwaps(jumble, locked),
            closestPair: gradient.closestPair,
            description: describePuzzle(patch, gradient.colours, locked),
        };
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How many tilings and gradients are drawn, at most, before giving up. None has ever needed more than a few. */
const MOST_ATTEMPTS = 200;

/** Locks the free piece of any shape that has only one, since it has nowhere else to go. */
function lockLoneShapes(patch: TilePatch, locked: Uint8Array): void {
    const freeCounts = new Int32Array(MOST_SHAPES);
    const lastFree = new Int32Array(MOST_SHAPES);
    for (let t = 0; t < patch.count; t++) {
        if (locked[t] === 1) continue;
        freeCounts[patch.shapes[t]]++;
        lastFree[patch.shapes[t]] = t;
    }
    for (let shape = 0; shape < MOST_SHAPES; shape++) if (freeCounts[shape] === 1) locked[lastFree[shape]] = 1;
}

/**
 * The piece on each tile: locked pieces at home, and the free pieces of
 * each shape shuffled among that shape's tiles until none is home.
 */
function jumblePieces(patch: TilePatch, locked: Uint8Array, random: Random): Uint16Array {
    const jumble = new Uint16Array(locked.length);
    for (let t = 0; t < locked.length; t++) jumble[t] = t;
    for (let shape = 0; shape < MOST_SHAPES; shape++) {
        const free: number[] = [];
        for (let t = 0; t < locked.length; t++) if (locked[t] === 0 && patch.shapes[t] === shape) free.push(t);
        if (free.length < 2) continue;
        const pieces = free.slice();
        for (;;) {
            for (let i = pieces.length - 1; i > 0; i--) {
                const j = Math.floor(random.next() * (i + 1));
                const swapped = pieces[i];
                pieces[i] = pieces[j];
                pieces[j] = swapped;
            }
            let isHomeFree = true;
            for (let i = 0; i < free.length && isHomeFree; i++) if (pieces[i] === free[i]) isHomeFree = false;
            if (isHomeFree) break;
        }
        for (let i = 0; i < free.length; i++) jumble[free[i]] = pieces[i];
    }
    return jumble;
}

/** More shapes than any tiling here has: a 12-fold tiling has six. */
const MOST_SHAPES = 16;

/** The fewest swaps that put every piece home: one fewer than its length for each cycle of the jumble. */
function countFewestSwaps(jumble: Readonly<Uint16Array>, locked: Readonly<Uint8Array>): number {
    const seen = new Uint8Array(jumble.length);
    let swaps = 0;
    for (let t = 0; t < jumble.length; t++) {
        if (seen[t] === 1 || locked[t] === 1) continue;
        let length = 0;
        for (let at = t; seen[at] === 0; at = jumble[at]) {
            seen[at] = 1;
            length++;
        }
        swaps += length - 1;
    }
    return swaps;
}

/** The symmetry, the frame, the count, and a checksum of the colours and locks (FNV-1a). */
function describePuzzle(patch: TilePatch, colours: readonly number[], locked: Readonly<Uint8Array>): string {
    let hash = 0x811c9dc5;
    for (let t = 0; t < colours.length; t++) {
        hash = Math.imul(hash ^ (colours[t] + locked[t] * 0x1000000), 0x01000193);
    }
    return `${patch.symmetry}/${patch.frame}/${patch.count}/${(hash >>> 0).toString(36)}`;
}
