import { onDestroyed, setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import { listenToPanZoom } from '@mvtjs/site-kit/input';
import type { TileSet } from '../models';
import type { ColorMode } from './color-mode';
import type { PaletteName } from './palette-name';
import { buildPaletteFills, type PaletteFills } from './palettes';
import { MAX_PIXEL_DENSITY, RAMP_SIZE, RING_WIDTH, SPIRAL_WIDTH, TONES, ZOOM_PER_DOUBLE_TAP, ZOOM_PER_WHEEL_NOTCH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TileCanvasViewBindings {
    /** The tiles to draw. */
    tiles: () => TileSet;
    /** The tiles they are dissolving into. */
    nextTiles: () => TileSet;
    /** How far the dissolve has gone, from 0, all `tiles`, to 1, all `nextTiles`. */
    tileBlend: () => number;
    /** The x of the window's centre, in tile edges. */
    centreX: () => number;
    /** The y of the window's centre, in tile edges. */
    centreY: () => number;
    /** How far the window reaches, from its centre to its furthest corner, in tile edges. */
    radius: () => number;
    /** How far the window is turned, in radians. Positive turns the tiling clockwise. */
    rotation: () => number;
    /** The palette the tiles are coloured from. */
    palette: () => PaletteName;
    /** What decides each tile's colour. */
    colorMode: () => ColorMode;
    /** Where on the palette the colours start, from 0 to 1. */
    colorOffset: () => number;
    /** The gap between neighbouring tiles, in tile edges. */
    gap: () => number;
    /** How far the tiles have drawn back to their crossings, from 0, where they lie in the tiling, to 1, where they have shrunk away. */
    drawBack: () => number;
    /** The tile picked out, as an index into the tiles, or -1 if none is. It shows with the grids. */
    pickedTile: () => number;
    /** Rises each time the visitor asks to save the picture. The view then saves what it shows. */
    picturesAsked: () => number;
    /** The tiling was dragged, so the window's centre should move by (`deltaX`, `deltaY`), in tile edges. */
    onMoved?: (deltaX: number, deltaY: number) => void;
    /** The tiling was zoomed in by `factor` about the point (`x`, `y`) of the tiling, in tile edges. */
    onZoomed?: (factor: number, x: number, y: number) => void;
    /** The tiling was turned clockwise by `angle` radians about the point (`x`, `y`) of the tiling, in tile edges. */
    onTurned?: (angle: number, x: number, y: number) => void;
    /** A tile was tapped or clicked, with the grids showing, at the point (`x`, `y`) of the tiling. */
    onTilePicked?: (x: number, y: number) => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The tiling, on a canvas that fills whatever it is given, and the fingers
 * and mouse that move it.
 *
 * The window's corners touch a circle of its radius, so the canvas's half
 * diagonal is that many tile edges, whatever its shape. Each frame that
 * anything has changed, it colours every tile on the canvas, sorts the
 * tiles by colour, and fills them one at a time. Sorting means the fill
 * colour changes only once for each colour, and drawing builds no strings:
 * every colour was made as its palette was chosen.
 *
 * Each tile gets a fill of its own, though one fill for all of a colour's
 * tiles looks cheaper. A tile is a small, simple shape, which the GPU draws
 * quickly. All of a colour's tiles together make one shape as wide as the
 * canvas, and some browsers take far longer over a few hundred of those,
 * in a part of the browser that a timer in JavaScript can't see.
 *
 * The tiles and the next tiles are painted as two whole pictures, and the
 * second is laid over the first by the blend. Whatever is the same in both
 * doesn't change, and each pixel of the rest moves smoothly from one colour
 * to the other, so nothing ever jumps or tears.
 *
 * As the tiles draw back, each moves to its crossing and shrinks, and the
 * grids' lines fade in over them, until only the lines are left.
 *
 * It speaks in gestures in CSS pixels, turned into moves of the tiling, in
 * tile edges. The canvas's size and the colours are this view's own.
 */
export function TileCanvasView(bindings: TileCanvasViewBindings): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'tiling-canvas';
    // The view does its own zooming and panning, so the browser's are off.
    canvas.style.touchAction = 'none';
    // A test environment has no canvas to draw on. Everything else still works.
    const context = canvas.getContext('2d') ?? undefined;

    // The next tiles are painted here, to lay over the canvas
    const nextPicture = document.createElement('canvas');
    const nextContext = nextPicture.getContext('2d') ?? undefined;

    let fills: PaletteFills = buildPaletteFills(bindings.palette());
    // The canvas's size in CSS pixels, which the gestures are measured in.
    let cssWidth = 0;
    let cssHeight = 0;
    let density = 1;

    // What was last drawn, so that a still frame is not drawn again
    let drawnVersion = -1;
    let drawnCentreX = Number.NaN;
    let drawnCentreY = Number.NaN;
    let drawnRadius = Number.NaN;
    let drawnRotation = Number.NaN;
    let drawnColorOffset = Number.NaN;
    let drawnGap = Number.NaN;
    let drawnColorMode: ColorMode | undefined;
    let drawnFills: PaletteFills | undefined;
    let drawnBack = Number.NaN;
    let drawnBlend = Number.NaN;
    let drawnPickedTile = -1;

    // From the tiling to the canvas's pixels, as this frame draws it
    let tilingScale = 1;
    let tilingCos = 1;
    let tilingSin = 0;
    let tilingX = 0;
    let tilingY = 0;

    // The tiles on the canvas, sorted by colour. Reused from frame to frame,
    // and grown as more tiles are laid.
    let colorKeys = new Int16Array(1024);
    let sorted = new Int32Array(1024);
    const keyCounts = new Int32Array(RAMP_SIZE * TONES);
    const keyStarts = new Int32Array(RAMP_SIZE * TONES);

    // The last picture saved. Its URL is held until the next one, because
    // letting go of it while the browser is still saving cancels the save.
    let pictureUrl: string | undefined;

    const watcher = watch({
        palette: bindings.palette,
        pictures: bindings.picturesAsked,
    });

    const stopPanZoom = listenToPanZoom({
        element: canvas,
        zoomPerWheelNotch: ZOOM_PER_WHEEL_NOTCH,
        zoomPerDoubleTap: ZOOM_PER_DOUBLE_TAP,
        onDragged: reportDrag,
        onZoomed: reportZoom,
        onTurned: reportTurn,
        onTapped: reportTap,
    });

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(canvas);

    setRefresh(canvas, refresh);
    onDestroyed(canvas, () => {
        resizeObserver.disconnect();
        stopPanZoom();
        if (pictureUrl !== undefined) URL.revokeObjectURL(pictureUrl);
    });
    return canvas;

    function refresh(): void {
        const changes = watcher.poll();
        if (changes.palette.changed) fills = buildPaletteFills(bindings.palette());
        // Before the first layout is observed, as when it is drawn headless, the size is read here
        if (cssWidth === 0) measure();

        // The canvas has a pixel for each device pixel, up to a limit.
        // Resizing it clears it, so it is then drawn again.
        const width = Math.max(1, Math.round(cssWidth * density));
        const height = Math.max(1, Math.round(cssHeight * density));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            drawnVersion = -1;
        }

        const tiles = bindings.tiles();
        const centreX = bindings.centreX();
        const centreY = bindings.centreY();
        const radius = bindings.radius();
        const rotation = bindings.rotation();
        const colorOffset = bindings.colorOffset();
        const gap = bindings.gap();
        const colorMode = bindings.colorMode();
        const nextTiles = bindings.nextTiles();
        const tileBlend = bindings.tileBlend();
        const drawBack = bindings.drawBack();
        const pickedTile = bindings.pickedTile();
        const isStill = tiles.version === drawnVersion && centreX === drawnCentreX && centreY === drawnCentreY
            && radius === drawnRadius && rotation === drawnRotation && colorOffset === drawnColorOffset
            && gap === drawnGap && colorMode === drawnColorMode && fills === drawnFills
            && drawBack === drawnBack && tileBlend === drawnBlend && pickedTile === drawnPickedTile;
        if (!isStill && context !== undefined) {
            drawnVersion = tiles.version;
            drawnCentreX = centreX;
            drawnCentreY = centreY;
            drawnRadius = radius;
            drawnRotation = rotation;
            drawnColorOffset = colorOffset;
            drawnGap = gap;
            drawnColorMode = colorMode;
            drawnFills = fills;
            drawnBack = drawBack;
            drawnBlend = tileBlend;
            drawnPickedTile = pickedTile;
            drawFrame(context, tiles, nextTiles, width, height);
        }
        // After drawing, so the picture holds this frame.
        if (changes.pictures.increased) savePicture();
    }

    /**
     * Draws a frame: the tiles, dissolving into the next tiles by the blend,
     * and the grids' lines over them, once the tiles have started to draw back.
     */
    function drawFrame(target: CanvasRenderingContext2D, tiles: TileSet, nextTiles: TileSet, width: number, height: number): void {
        const radius = drawnRadius;
        if (!(radius > 0)) return;

        // From the tiling to the canvas: turned, scaled, and centred
        tilingScale = (0.5 * Math.hypot(width, height)) / radius;
        tilingCos = Math.cos(drawnRotation) * tilingScale;
        tilingSin = Math.sin(drawnRotation) * tilingScale;
        tilingX = width * 0.5 - (tilingCos * drawnCentreX - tilingSin * drawnCentreY);
        tilingY = height * 0.5 - (tilingSin * drawnCentreX + tilingCos * drawnCentreY);

        paintTiles(target, tiles, width, height);
        if (drawnBlend > 0 && nextContext !== undefined) {
            if (nextPicture.width !== width) nextPicture.width = width;
            if (nextPicture.height !== height) nextPicture.height = height;
            paintTiles(nextContext, nextTiles, width, height);
            target.setTransform(1, 0, 0, 1, 0, 0);
            target.globalAlpha = drawnBlend;
            target.drawImage(nextPicture, 0, 0);
            target.globalAlpha = 1;
        }

        if (drawnBack > 0) {
            target.setTransform(tilingCos, tilingSin, -tilingSin, tilingCos, tilingX, tilingY);
            drawGridLines(target, tiles, nextTiles);
            drawPickedTile(target, tiles, nextTiles);
        }
    }

    /** Clears the picture to the backdrop, then fills the tiles on it, one by one, a colour at a time. */
    function paintTiles(target: CanvasRenderingContext2D, tiles: TileSet, width: number, height: number): void {
        target.setTransform(1, 0, 0, 1, 0, 0);
        target.fillStyle = fills.backdrop;
        target.fillRect(0, 0, width, height);
        target.setTransform(tilingCos, tilingSin, -tilingSin, tilingCos, tilingX, tilingY);

        sortTilesByColor(tiles, width, height);
        // Half the gap comes off each side of every tile
        const inset = drawnGap * 0.5;
        let next = 0;
        for (let key = 0; key < keyCounts.length; key++) {
            const end = next + keyCounts[key];
            if (end === next) continue;
            target.fillStyle = fills.fills[key];
            for (; next < end; next++) {
                target.beginPath();
                addTile(target, tiles, sorted[next], inset, drawnBack);
                target.fill();
            }
        }
    }

    /**
     * Adds a tile to the path. Its sides come in by `inset`, and it draws
     * back to its crossing as `drawBack` goes from 0 to 1, shrinking away as
     * it goes.
     */
    function addTile(target: CanvasRenderingContext2D, tiles: TileSet, tile: number, inset: number, drawBack: number): void {
        const { cornerXs, cornerYs } = tiles;
        const at = tile * 4;
        const x0 = cornerXs[at];
        const y0 = cornerYs[at];
        // The tile's two sides from its first corner, which are one edge long
        const ux = cornerXs[at + 1] - x0;
        const uy = cornerYs[at + 1] - y0;
        const vx = cornerXs[at + 3] - x0;
        const vy = cornerYs[at + 3] - y0;
        // Each corner moves toward the middle far enough that every side
        // moves in by `inset`, which is `inset` divided by the sine of the
        // tile's angle, along these. A thin tile is never inset past its
        // own middle.
        const sine = Math.abs(ux * vy - uy * vx);
        const fit = Math.min(inset, sine * MAX_INSET_SHARE) / sine;
        const reach = (0.5 - fit) * (1 - drawBack);
        const middleX = x0 + (ux + vx) * 0.5;
        const middleY = y0 + (uy + vy) * 0.5;
        const drawnX = middleX + (tiles.crossingXs[tile] - middleX) * drawBack;
        const drawnY = middleY + (tiles.crossingYs[tile] - middleY) * drawBack;
        // From the middle to the first and third corners, and to the second and fourth
        const sumX = (ux + vx) * reach;
        const sumY = (uy + vy) * reach;
        const differenceX = (ux - vx) * reach;
        const differenceY = (uy - vy) * reach;
        target.moveTo(drawnX - sumX, drawnY - sumY);
        target.lineTo(drawnX + differenceX, drawnY + differenceY);
        target.lineTo(drawnX + sumX, drawnY + sumY);
        target.lineTo(drawnX - differenceX, drawnY - differenceY);
        target.closePath();
    }

    /** Draws every line of every grid over the canvas, fading in as the tiles draw back, each grid in a colour of its own. */
    function drawGridLines(target: CanvasRenderingContext2D, tiles: TileSet, nextTiles: TileSet): void {
        const { gridCount, gridCosines, gridSines, lineSpacing } = tiles;
        const reach = drawnRadius * LINE_REACH;
        target.globalAlpha = drawnBack * GRID_LINE_ALPHA;
        target.lineWidth = (GRID_LINE_PIXELS * density) / tilingScale;
        for (let grid = 0; grid < gridCount; grid++) {
            // The palette's brighter end, which shows up against the backdrop
            const share = GRID_COLOR_START + ((1 - GRID_COLOR_START) * grid) / (gridCount - 1);
            target.strokeStyle = fills.fills[Math.round(share * (RAMP_SIZE - 1)) * TONES + TONES - 1];
            const along = drawnCentreX * gridCosines[grid] + drawnCentreY * gridSines[grid];
            const start = findGridStart(tiles, nextTiles, grid);
            const firstLine = Math.ceil((along - reach - start) / lineSpacing);
            const lastLine = Math.floor((along + reach - start) / lineSpacing);
            target.beginPath();
            for (let line = firstLine; line <= lastLine; line++) addLine(target, tiles, nextTiles, grid, line, reach);
            target.stroke();
        }
        target.globalAlpha = 1;
    }

    /** Where a grid's line 0 lies now, part of the way from the tiles to the next tiles, so that the lines slide smoothly. */
    function findGridStart(tiles: TileSet, nextTiles: TileSet, grid: number): number {
        return tiles.gridStarts[grid] + (nextTiles.gridStarts[grid] - tiles.gridStarts[grid]) * drawnBlend;
    }

    /** Adds to the path a line of a grid, reaching `reach` either side of the window's centre. */
    function addLine(target: CanvasRenderingContext2D, tiles: TileSet, nextTiles: TileSet, grid: number, line: number, reach: number): void {
        const cos = tiles.gridCosines[grid];
        const sin = tiles.gridSines[grid];
        const along = findGridStart(tiles, nextTiles, grid) + line * tiles.lineSpacing;
        const across = drawnCentreY * cos - drawnCentreX * sin;
        // The line runs at right angles to the way its grid steps
        target.moveTo(along * cos - (across - reach) * sin, along * sin + (across - reach) * cos);
        target.lineTo(along * cos - (across + reach) * sin, along * sin + (across + reach) * cos);
    }

    /** Outlines the tile picked out, and the two lines it comes from. */
    function drawPickedTile(target: CanvasRenderingContext2D, tiles: TileSet, nextTiles: TileSet): void {
        const tile = drawnPickedTile;
        if (tile < 0 || tile >= tiles.count) return;
        const pair = tiles.pairs[tile];
        const reach = drawnRadius * LINE_REACH;
        target.globalAlpha = Math.min(1, drawnBack * 2);
        target.strokeStyle = HIGHLIGHT;
        target.lineWidth = (PICKED_LINE_PIXELS * density) / tilingScale;
        target.beginPath();
        addLine(target, tiles, nextTiles, tiles.pairFirstGrids[pair], tiles.firstLines[tile], reach);
        addLine(target, tiles, nextTiles, tiles.pairSecondGrids[pair], tiles.secondLines[tile], reach);
        addTile(target, tiles, tile, drawnGap * 0.5, drawnBack);
        target.stroke();
        target.globalAlpha = 1;
    }

    /**
     * Works out the colour of every tile that lands on the canvas, and sorts
     * them by colour into `sorted`, with `keyCounts` saying how many of each
     * colour there are.
     */
    function sortTilesByColor(tiles: TileSet, width: number, height: number): void {
        const { count, cornerXs, cornerYs, crossingXs, crossingYs, shapes, pairs, pairHeadings, shapeCount } = tiles;
        if (colorKeys.length < count) {
            colorKeys = new Int16Array(count * 2);
            sorted = new Int32Array(count * 2);
        }
        keyCounts.fill(0);
        const mode = drawnColorMode;
        const colorOffset = drawnColorOffset;
        for (let i = 0; i < count; i++) {
            const at = i * 4;
            const middleX = (cornerXs[at] + cornerXs[at + 2]) * 0.5;
            const middleY = (cornerYs[at] + cornerYs[at + 2]) * 0.5;
            // Tiles off the canvas are left out, wherever they have drawn back to
            const drawnX = middleX + (crossingXs[i] - middleX) * drawnBack;
            const drawnY = middleY + (crossingYs[i] - middleY) * drawnBack;
            const canvasX = tilingCos * drawnX - tilingSin * drawnY + tilingX;
            const canvasY = tilingSin * drawnX + tilingCos * drawnY + tilingY;
            if (canvasX < -tilingScale || canvasX > width + tilingScale || canvasY < -tilingScale || canvasY > height + tilingScale) {
                colorKeys[i] = -1;
                continue;
            }

            const shape = shapes[i];
            // How far along the palette the tile's colour is, which goes up
            // to its far end at a half, and back again at 1
            let along: number;
            let tone: number;
            if (mode === 'shapes') {
                along = ((shape + 0.5) / shapeCount) * 0.5;
                tone = pairs[i] % TONES;
            }
            else {
                if (mode === 'directions') along = pairHeadings[pairs[i]] * 0.5;
                else if (mode === 'rings') along = Math.sqrt(middleX * middleX + middleY * middleY) / RING_WIDTH;
                else along = Math.atan2(middleY, middleX) / (Math.PI * 2) + Math.sqrt(middleX * middleX + middleY * middleY) / SPIRAL_WIDTH;
                tone = shapeCount === 1 ? 1 : Math.round((shape * (TONES - 1)) / (shapeCount - 1));
            }
            along += colorOffset;
            along -= Math.floor(along);
            const share = along < 0.5 ? along * 2 : 2 - along * 2;
            const ramp = Math.min(RAMP_SIZE - 1, Math.floor(share * RAMP_SIZE));
            const key = ramp * TONES + tone;
            colorKeys[i] = key;
            keyCounts[key]++;
        }

        // Where each colour's tiles start in `sorted`, then each tile in its place
        let start = 0;
        for (let key = 0; key < keyCounts.length; key++) {
            keyStarts[key] = start;
            start += keyCounts[key];
        }
        for (let i = 0; i < count; i++) {
            const key = colorKeys[i];
            if (key >= 0) sorted[keyStarts[key]++] = i;
        }
    }

    /** Notes the canvas's size in CSS pixels, and how many device pixels to draw for each. */
    function measure(): void {
        cssWidth = canvas.clientWidth;
        cssHeight = canvas.clientHeight;
        density = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_DENSITY);
    }

    /** How many CSS pixels one tile edge is, or 0 before the canvas has a size. */
    function measureEdge(): number {
        const radius = bindings.radius();
        return radius > 0 ? (0.5 * Math.hypot(cssWidth, cssHeight)) / radius : 0;
    }

    /** Turns a drag of the canvas into a move of the window's centre, the other way, so the tiling follows the finger. */
    function reportDrag(deltaX: number, deltaY: number): void {
        const edge = measureEdge();
        if (edge <= 0) return;
        const rotation = bindings.rotation();
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        bindings.onMoved?.(-(deltaX * cos + deltaY * sin) / edge, -(deltaY * cos - deltaX * sin) / edge);
    }

    /** Turns a tap of the canvas into a tile picked, while the grids show. */
    function reportTap(x: number, y: number): void {
        const edge = measureEdge();
        if (edge <= 0 || bindings.drawBack() <= 0) return;
        bindings.onTilePicked?.(findTilingX(x, y, edge), findTilingY(x, y, edge));
    }

    /** Turns a zoom about a point of the canvas into a zoom about a point of the tiling. */
    function reportZoom(factor: number, x: number, y: number): void {
        const edge = measureEdge();
        if (edge <= 0) return;
        bindings.onZoomed?.(factor, findTilingX(x, y, edge), findTilingY(x, y, edge));
    }

    /** Turns a turn about a point of the canvas into a turn about a point of the tiling. */
    function reportTurn(angle: number, x: number, y: number): void {
        const edge = measureEdge();
        if (edge <= 0) return;
        bindings.onTurned?.(angle, findTilingX(x, y, edge), findTilingY(x, y, edge));
    }

    /** The x of the tiling at the point (`x`, `y`) of the canvas, in CSS pixels. */
    function findTilingX(x: number, y: number, edge: number): number {
        const rotation = bindings.rotation();
        const fromX = (x - cssWidth * 0.5) / edge;
        const fromY = (y - cssHeight * 0.5) / edge;
        return bindings.centreX() + fromX * Math.cos(rotation) + fromY * Math.sin(rotation);
    }

    /** The y of the tiling at the point (`x`, `y`) of the canvas, in CSS pixels. */
    function findTilingY(x: number, y: number, edge: number): number {
        const rotation = bindings.rotation();
        const fromX = (x - cssWidth * 0.5) / edge;
        const fromY = (y - cssHeight * 0.5) / edge;
        return bindings.centreY() + fromY * Math.cos(rotation) - fromX * Math.sin(rotation);
    }

    /** Hands the canvas, as it stands, to the browser to save as a PNG. */
    function savePicture(): void {
        if (canvas.width <= 1 || canvas.height <= 1) return;
        canvas.toBlob((blob) => {
            // The browser gives nothing where it cannot make the picture.
            if (blob === null) return;
            if (pictureUrl !== undefined) URL.revokeObjectURL(pictureUrl);
            pictureUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = pictureUrl;
            link.download = 'penrose-tiling.png';
            link.click();
        }, 'image/png');
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The most of a tile's sine that its inset may be, so even the thinnest tile keeps some colour. */
const MAX_INSET_SHARE = 0.4;

/** How far past the window's centre each line is drawn, as a share of the radius. */
const LINE_REACH = 1.05;

/** How the grids' lines are drawn: their width in CSS pixels, how solid they are, and where on the palette their colours start. */
const GRID_LINE_PIXELS = 1.25;
const GRID_LINE_ALPHA = 0.8;
const GRID_COLOR_START = 0.45;

/** The width of the lines through a picked tile, and of the tile's outline, in CSS pixels. */
const PICKED_LINE_PIXELS = 2.5;

/** The colour that stands out against every palette. */
const HIGHLIGHT = '#ffffff';
