import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import type { CellKind } from '../data';
import { hashCell } from './drawing';
import { COLOURS, type StrawColours } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MeadowViewBindings {
    /** The meadow's size in cells, and a cell's size in pixels. The view is built round them, so they are read once. */
    rows: number;
    cols: number;
    cellSize: number;
    cellKindAt: (row: number, col: number) => CellKind;
    /** Which wire fenced off cell (row, col), counting from 1, or 0 for one not fenced off. */
    closureAt: (row: number, col: number) => number;
    /** Wires tied off so far. As it rises, the new pasture flashes. */
    closureCount: () => number;
    /** The round. Each round is a new meadow. */
    round: () => number;
    /** The colours of the wild grass, which change from farm to farm. */
    grass: () => StrawColours;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The ground. Where the meadow is open, it is wild, dry grass in the farm's
 * colours, with wind rippling across it. Where it has been fenced off, it
 * is green pasture scattered with flowers. The ponds and rocks sit in it.
 * Pasture fenced off by the latest wire flashes as it appears. The pasture
 * is redrawn only when a wire is tied off, or a round starts, and the wild
 * grass only when its colours change.
 */
export function MeadowView(bindings: MeadowViewBindings): Container {
    const { rows, cols, cellSize } = bindings;
    const width = cols * cellSize;
    const height = rows * cellSize;

    const wild = new Graphics();
    const windMask = new Graphics().rect(0, 0, width, height).fill(0xffffff);
    const wind = new Graphics();
    wind.mask = windMask;
    const pasture = new Graphics();
    const flash = new Graphics();

    const view = new Container();
    view.addChild(wild, windMask, wind, pasture, flash);

    // Presentation state: how long the wind has blown, and how long since
    // the latest wire was tied off, for its flash
    let windMs = 0;
    let flashMs = FLASH_MS;
    const flashWatcher = watch({ closures: bindings.closureCount });
    flashWatcher.poll();
    const drawWatcher = watch({ closures: bindings.closureCount, round: bindings.round });
    // The colours the wild grass was last drawn in
    let drawnGrass: StrawColours | undefined;

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        windMs += deltaMs;
        flashMs = flashWatcher.poll().closures.increased ? 0 : flashMs + deltaMs;
    }

    function refresh(): void {
        const grass = bindings.grass();
        if (grass !== drawnGrass) {
            drawnGrass = grass;
            drawWildGrass(grass);
            drawWind(grass);
        }
        const watched = drawWatcher.poll();
        if (watched.closures.changed || watched.round.changed) {
            drawPasture();
            drawFlash(watched.closures.value);
        }
        wind.x = Math.round((windMs * WIND_SPEED) % WIND_PERIOD) - WIND_PERIOD;
        flash.alpha = Math.max(0, 1 - flashMs / FLASH_MS) * 0.7;
    }

    // ---- Drawing -----------------------------------------------------------

    function drawWildGrass(colours: StrawColours): void {
        const g = wild.clear();
        g.rect(0, 0, width, height).fill(colours.straw);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const hash = hashCell(r, c);
                const x = c * cellSize + (hash % (cellSize - 1));
                const y = r * cellSize + ((hash >>> 4) % (cellSize - 3));
                // A blade or two of darker grass in most cells, and a light seed head in some
                if ((hash & 0x300) !== 0) g.rect(x, y, 1, 3).fill(colours.strawDark);
                if ((hash & 0x3000) === 0) g.rect(x + 2, y + 1, 1, 2).fill(colours.strawDark);
                if ((hash & 0x70000) === 0) g.rect((x + 4) % width, y, 1, 1).fill(colours.strawLight);
            }
        }
    }

    /** Soft light bands, slanting, wider than the meadow by one period so they can scroll. */
    function drawWind(colours: StrawColours): void {
        const g = wind.clear();
        for (let x = 0; x < width + WIND_PERIOD * 2; x += WIND_PERIOD) {
            g.poly([x, 0, x + 40, 0, x + 40 - height * 0.4, height, x - height * 0.4, height])
                .fill({ color: colours.strawLight, alpha: 0.14 });
        }
    }

    function drawPasture(): void {
        pasture.clear();
        for (let r = 0; r < rows; r++) {
            let runStart = 0;
            let runKind = bindings.cellKindAt(r, 0);
            for (let c = 1; c <= cols; c++) {
                const kind = c < cols ? bindings.cellKindAt(r, c) : 'meadow';
                if (c < cols && kind === runKind) continue;
                if (runKind !== 'meadow') drawRun(r, runStart, c, runKind);
                runStart = c;
                runKind = kind;
            }
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) drawDetail(r, c, bindings.cellKindAt(r, c));
        }
    }

    function drawRun(row: number, fromCol: number, toCol: number, kind: CellKind): void {
        const x = fromCol * cellSize;
        const y = row * cellSize;
        const runWidth = (toCol - fromCol) * cellSize;
        // Mown stripes, two cells wide, for pasture
        const colour = kind === 'pasture'
            ? (Math.floor(row / 2) % 2 === 0 ? COLOURS.grass : COLOURS.grassStripe)
            : kind === 'pond' ? COLOURS.pond : COLOURS.rockGround;
        pasture.rect(x, y, runWidth, cellSize).fill(colour);
    }

    /** A flower on some pasture, a ripple on some pond, and a boulder on each rock cell. */
    function drawDetail(row: number, col: number, kind: CellKind): void {
        const hash = hashCell(row, col);
        const x = col * cellSize;
        const y = row * cellSize;
        if (kind === 'pasture') {
            if (hash % 9 === 0) {
                const fx = x + 1 + ((hash >>> 5) % (cellSize - 3));
                const fy = y + 1 + ((hash >>> 9) % (cellSize - 3));
                pasture.rect(fx, fy, 2, 2).fill(FLOWER_COLOURS[(hash >>> 13) % FLOWER_COLOURS.length]);
            }
            else if (hash % 5 === 0) {
                pasture.rect(x + ((hash >>> 5) % cellSize), y + ((hash >>> 9) % (cellSize - 2)), 1, 2).fill(COLOURS.grassDark);
            }
        }
        else if (kind === 'pond') {
            if (hash % 4 === 0) pasture.rect(x + ((hash >>> 5) % (cellSize - 3)), y + ((hash >>> 9) % cellSize), 3, 1).fill(COLOURS.pondLight);
            drawShore(row, col, x, y);
        }
        else if (kind === 'rock') {
            drawBoulder(x + cellSize / 2, y + cellSize / 2, hash);
        }
    }

    /**
     * Draws a boulder near (x, y). It is a round stone with a shadow below
     * it and light on its top left, and its size and place vary with
     * `hash`. Drawn a cell at a time, top to bottom, the boulders overlap into
     * a rocky outcrop.
     */
    function drawBoulder(x: number, y: number, hash: number): void {
        const radius = 3.5 + (hash % 3) * 0.75;
        const bx = Math.round(x + ((hash >>> 4) % 3) - 1);
        const by = Math.round(y + ((hash >>> 6) % 3) - 1);
        pasture.circle(bx + 1, by + 1.5, radius).fill(COLOURS.rockDark);
        pasture.circle(bx, by, radius).fill(COLOURS.rock);
        pasture.circle(bx - radius * 0.35, by - radius * 0.4, radius * 0.45).fill(COLOURS.rockLight);
        if (hash % 4 === 0) pasture.rect(bx + 1, by, 1, 2).fill(COLOURS.rockDark);
    }

    /** A sandy edge on each side of a pond cell that faces dry land. */
    function drawShore(row: number, col: number, x: number, y: number): void {
        if (bindings.cellKindAt(row - 1, col) !== 'pond') pasture.rect(x, y, cellSize, 1).fill(COLOURS.pondEdge);
        if (bindings.cellKindAt(row + 1, col) !== 'pond') pasture.rect(x, y + cellSize - 1, cellSize, 1).fill(COLOURS.pondEdge);
        if (bindings.cellKindAt(row, col - 1) !== 'pond') pasture.rect(x, y, 1, cellSize).fill(COLOURS.pondEdge);
        if (bindings.cellKindAt(row, col + 1) !== 'pond') pasture.rect(x + cellSize - 1, y, 1, cellSize).fill(COLOURS.pondEdge);
    }

    /** The cells the latest wire fenced off, in white, for the flash. */
    function drawFlash(closure: number): void {
        flash.clear();
        if (closure === 0) return;
        for (let r = 0; r < rows; r++) {
            let runStart = -1;
            for (let c = 0; c <= cols; c++) {
                const isNew = c < cols && bindings.closureAt(r, c) === closure;
                if (isNew && runStart < 0) runStart = c;
                if (!isNew && runStart >= 0) {
                    flash.rect(runStart * cellSize, r * cellSize, (c - runStart) * cellSize, cellSize).fill(0xffffff);
                    runStart = -1;
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FLASH_MS = 500;
/** How far apart the wind's bands are, and how fast they cross the meadow, in pixels per ms. */
const WIND_PERIOD = 150;
const WIND_SPEED = 0.03;
const FLOWER_COLOURS: readonly number[] = [COLOURS.flowerWhite, COLOURS.flowerYellow, COLOURS.flowerPink];
