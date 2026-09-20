/**
 * A row of tiles that periodically swap places.
 *
 * The domain is deliberately tiny: an ordered list and a `swap`. There is no
 * notion of position in pixels, of motion, or of animation - a swap is
 * instantaneous here. Everything the eye sees moving is presentation state,
 * owned by the view side.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Tile {
    /** Dense: ids run 0..tileCount-1 for the life of the list. */
    readonly id: number;
    readonly label: string;
}

export interface SwapModel {
    readonly tileCount: number;
    getTile(index: number): Tile;
    swap(a: number, b: number): void;
    /** Swap the tile at `index` with the one to its right, wrapping at the end. */
    swapWithNext(index: number): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SwapModelOptions {
    readonly labels: readonly string[];
    /** Milliseconds between automatic swaps. */
    readonly autoSwapMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSwapModel(options: SwapModelOptions): SwapModel {
    const tiles: Tile[] = [];
    for (let i = 0; i < options.labels.length; i++) {
        tiles.push({ id: i, label: options.labels[i] });
    }

    let sinceSwapMs = 0;
    let randomState = 0x2f6e2b1;

    return {
        get tileCount() { return tiles.length; },
        getTile,
        swap,
        swapWithNext,
        update,
    };

    function getTile(index: number): Tile {
        return tiles[index];
    }

    function swap(a: number, b: number): void {
        const tile = tiles[a];
        tiles[a] = tiles[b];
        tiles[b] = tile;
    }

    function swapWithNext(index: number): void {
        swap(index, (index + 1) % tiles.length);
    }

    function update(deltaMs: number): void {
        sinceSwapMs += deltaMs;
        if (sinceSwapMs < options.autoSwapMs) return;
        sinceSwapMs -= options.autoSwapMs;

        const a = nextRandomIndex();
        const b = nextRandomIndex();
        swap(a, a === b ? (b + 1) % tiles.length : b);
    }

    /** Deterministic PRNG, so the demo thumbnail is reproducible. */
    function nextRandomIndex(): number {
        randomState = (randomState * 1664525 + 1013904223) >>> 0;
        return (randomState >>> 8) % tiles.length;
    }
}
