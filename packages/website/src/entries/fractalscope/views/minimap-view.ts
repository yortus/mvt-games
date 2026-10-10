import { setRefresh } from '@mvtjs/html';
import { watch } from '@mvtjs/utils';
import type { PaletteName } from '../data';
import type { EscapeGrid, PlaneRegion } from '../models';
import { buildPaletteColors, paintEscapes, type PaletteColors } from './palettes';
import { MIN_VIEW_MARK, MINIMAP_HEIGHT, MINIMAP_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface MinimapViewBindings {
    /** The whole fractal at a glance, over its home view. The map covers the overview's region. */
    overview: () => EscapeGrid;
    /** The region being looked at, marked on the map. */
    region: () => PlaneRegion;
    /** The shape of the view the region is seen through, as its width over its height. */
    aspect: () => number;
    /** The colours the map is drawn in. */
    palette: () => PaletteName;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The whole fractal as a small map, with a mark where the view is. The map
 * is the overview, in the palette the image uses, so the two agree.
 *
 * Zoomed in, the view is a vanishingly small part of the set, so the mark
 * stops shrinking at a few pixels and reads as a pin on the spot. Panned
 * past the edge of the home view, it holds to the edge nearest where the
 * view has gone.
 */
export function MinimapView(bindings: MinimapViewBindings): Element {
    const canvas = document.createElement('canvas');
    canvas.className = 'scope-minimap';
    canvas.width = MINIMAP_WIDTH;
    canvas.height = MINIMAP_HEIGHT;
    const screen = canvas.getContext('2d') ?? undefined;

    // The map as coloured, one pixel per sample of the overview.
    const picture = document.createElement('canvas');
    const paper = picture.getContext('2d') ?? undefined;
    let image: ImageData | undefined;
    let pixels: Int32Array | undefined;
    let paintedCols = 0;
    let paintedRows = 0;
    let colors: PaletteColors = buildPaletteColors(bindings.palette());

    const watcher = watch({
        revision: () => bindings.overview().revision,
        palette: bindings.palette,
    });

    setRefresh(canvas, refresh);
    return canvas;

    function refresh(): void {
        const overview = bindings.overview();
        const changes = watcher.poll();
        // A test environment has no canvas to draw on.
        if (screen === undefined || paper === undefined) return;

        let isStale = changes.revision.changed || changes.palette.changed;
        if (overview.cols !== paintedCols || overview.rows !== paintedRows) {
            resizePicture(paper, overview.cols, overview.rows);
            isStale = true;
        }
        if (changes.palette.changed) colors = buildPaletteColors(changes.palette.value);

        // The overview is a few thousand samples, so it is coloured whole
        // rather than row by row.
        if (isStale && image !== undefined && pixels !== undefined) {
            paintEscapes(pixels, overview.escapes, 0, overview.cols * overview.rows, colors);
            paper.putImageData(image, 0, 0);
        }

        screen.imageSmoothingEnabled = true;
        screen.drawImage(picture, 0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
        markView(screen, overview.region);
    }

    function resizePicture(context: CanvasRenderingContext2D, cols: number, rows: number): void {
        picture.width = cols;
        picture.height = rows;
        image = context.createImageData(cols, rows);
        pixels = new Int32Array(image.data.buffer);
        paintedCols = cols;
        paintedRows = rows;
    }

    /** Outlines where the view sits on the map, which covers `map`. */
    function markView(context: CanvasRenderingContext2D, map: PlaneRegion): void {
        const looking = bindings.region();
        const aspect = bindings.aspect();
        if (!(looking.span > 0) || !(aspect > 0) || !(map.span > 0)) return;

        const unitsPerPixel = map.span / MINIMAP_WIDTH;
        const mapHeight = map.span * (MINIMAP_HEIGHT / MINIMAP_WIDTH);
        const centerX = (looking.centerRe - (map.centerRe - map.span * 0.5)) / unitsPerPixel;
        const centerY = (map.centerIm + mapHeight * 0.5 - looking.centerIm) / unitsPerPixel;
        const width = Math.max(MIN_VIEW_MARK, looking.span / unitsPerPixel);
        const height = Math.max(MIN_VIEW_MARK, looking.span / aspect / unitsPerPixel);
        // Held to the map, so that a view panned past its edge still shows.
        const x = Math.min(MINIMAP_WIDTH, Math.max(0, centerX)) - width * 0.5;
        const y = Math.min(MINIMAP_HEIGHT, Math.max(0, centerY)) - height * 0.5;

        // A dark line under a light one, so the mark shows over the pale
        // bands as well as the dark ones.
        context.lineWidth = 3;
        context.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        context.strokeRect(x, y, width, height);
        context.lineWidth = 1.25;
        context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        context.strokeRect(x, y, width, height);
    }
}
