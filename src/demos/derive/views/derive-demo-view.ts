import { Container, Text } from 'pixi.js';
import { createOccupancyGrid, createActiveOrder, createKindHistogram } from '../derivations';
import type { WorldModel, WorldEntity } from '../models';
import { createGridView } from './grid-view';
import { createOrderView } from './order-view';
import { createHistogramView } from './histogram-view';
import { createControlsView } from './controls-view';
import { FONT, TEXT_MAIN, TEXT_DIM, TEXT_RESOLUTION, FLASH_MS } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface DeriveDemoLayout {
    screenWidth: number;
    screenHeight: number;
    header: Rect;
    grid: Rect;
    order: Rect;
    histogram: Rect;
    controls: Rect;
}

/** Top-level demo view. Holds cosmetic presentation state (recompute counters). */
export interface DeriveDemoView extends Container {
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DeriveDemoViewOptions {
    model: WorldModel;
    layout: DeriveDemoLayout;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDeriveDemoView(options: DeriveDemoViewOptions): DeriveDemoView {
    const { model, layout } = options;

    // The derived structures - the whole point of the demo.
    const occupancy = createOccupancyGrid(model);
    const order = createActiveOrder(model);
    const histogram = createKindHistogram(model);

    // Cosmetic presentation state: latest snapshots, recompute tallies, flashes.
    let gridSnap = occupancy.poll();
    let orderSnap: readonly WorldEntity[] = order.poll();
    let histSnap = histogram.poll();
    let gridRecomputes = 0;
    let orderRecomputes = 0;
    let histRecomputes = 0;
    let gridFlash = 0;
    let orderFlash = 0;
    let histFlash = 0;

    const view = new Container() as DeriveDemoView;

    const header = new Text({
        text: 'Derive  \u2014  model \u2192 derived structures \u2192 views',
        resolution: TEXT_RESOLUTION,
        style: { fontFamily: FONT, fontSize: 16, fill: TEXT_MAIN, fontWeight: 'bold' },
    });
    header.position.set(layout.header.x, layout.header.y);
    view.addChild(header);

    const caption = new Text({
        text: 'One churning model feeds three derived structures. Each recomputes only when its triggers change - watch the tallies.',
        resolution: TEXT_RESOLUTION,
        style: { fontFamily: FONT, fontSize: 11, fill: TEXT_DIM },
    });
    caption.position.set(layout.header.x, layout.header.y + 20);
    view.addChild(caption);

    const gridView = createGridView({
        width: layout.grid.width,
        height: layout.grid.height,
        getGrid: () => gridSnap,
        getRows: () => model.rows,
        getCols: () => model.cols,
        getPhase: () => model.phase,
        getRecomputes: () => gridRecomputes,
        getFlash: () => gridFlash,
    });
    gridView.position.set(layout.grid.x, layout.grid.y);
    view.addChild(gridView);

    const orderView = createOrderView({
        width: layout.order.width,
        height: layout.order.height,
        getEntities: () => orderSnap,
        getRecomputes: () => orderRecomputes,
        getFlash: () => orderFlash,
    });
    orderView.position.set(layout.order.x, layout.order.y);
    view.addChild(orderView);

    const histogramView = createHistogramView({
        width: layout.histogram.width,
        height: layout.histogram.height,
        getCounts: () => histSnap,
        getRecomputes: () => histRecomputes,
        getFlash: () => histFlash,
    });
    histogramView.position.set(layout.histogram.x, layout.histogram.y);
    view.addChild(histogramView);

    const controls = createControlsView({
        width: layout.controls.width,
        height: layout.controls.height,
        onSpawn: () => model.spawn(),
        onRemove: () => model.removeOne(),
        onRetype: () => model.retypeOne(),
        onMove: () => model.moveOne(),
        onToggleActive: () => model.toggleActiveOne(),
        getAutoChurn: () => model.autoChurn,
        onToggleChurn: () => { model.autoChurn = !model.autoChurn; },
    });
    controls.position.set(layout.controls.x, layout.controls.y);
    view.addChild(controls);

    view.update = update;
    return view;

    // ---- Update ------------------------------------------------------------

    function update(deltaMs: number): void {
        // Poll each derived structure once per frame; a recompute bumps its
        // tally and re-lights its flash. This is the demo's window into gating.
        gridSnap = occupancy.poll();
        if (occupancy.changed) {
            gridRecomputes++;
            gridFlash = 1;
        }
        orderSnap = order.poll();
        if (order.changed) {
            orderRecomputes++;
            orderFlash = 1;
        }
        histSnap = histogram.poll();
        if (histogram.changed) {
            histRecomputes++;
            histFlash = 1;
        }

        const decay = deltaMs / FLASH_MS;
        gridFlash = gridFlash > decay ? gridFlash - decay : 0;
        orderFlash = orderFlash > decay ? orderFlash - decay : 0;
        histFlash = histFlash > decay ? histFlash - decay : 0;
    }
}
