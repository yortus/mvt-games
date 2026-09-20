/** @jsxImportSource #pixi-jsx */

import type { Container, Graphics } from 'pixi.js';
import type { StatefulPixiView } from '#common';
import type { SwapModel } from './swap-model';
import { createSwapViewModel, type SwapViewModel } from './swap-view-model';
import { List } from './list';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSwapView(model: SwapModel): StatefulPixiView {
    const slotKeyed = createSwapViewModel({
        getTileCount: () => model.tileCount,
        getTileId: (index) => model.getTile(index).id,
        keyBy: 'slot',
        pitchPx: TILE_PITCH_PX,
    });

    const itemKeyed = createSwapViewModel({
        getTileCount: () => model.tileCount,
        getTileId: (index) => model.getTile(index).id,
        keyBy: 'item',
        pitchPx: TILE_PITCH_PX,
    });

    const view: Container = (
        <container label="list-swap">
            <text text="Tap a tile to swap it right. Pairs also swap on a timer." x={MARGIN_PX} y={16} style={CAPTION_STYLE} />

            <text text="keyBy: 'slot'  -  state follows the position" x={MARGIN_PX} y={62} style={HEADING_STYLE} />
            <text text="labels jump, nothing animates" x={MARGIN_PX} y={82} style={CAPTION_STYLE} />
            {tileRow(model, slotKeyed, ROW_A_Y)}

            <text text="keyBy: 'item'  -  state follows the tile" x={MARGIN_PX} y={192} style={HEADING_STYLE} />
            <text text="tiles slide past each other and pulse on arrival" x={MARGIN_PX} y={212} style={CAPTION_STYLE} />
            {tileRow(model, itemKeyed, ROW_B_Y)}
        </container>
    );

    return Object.assign(view, { update });

    function update(deltaMs: number): void {
        slotKeyed.update(deltaMs);
        itemKeyed.update(deltaMs);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * One row of tiles. The list is index-addressed: slot `index` renders whatever
 * tile the model holds at that index right now, and re-reads it every frame.
 * A swap rebuilds, moves and destroys nothing.
 */
function tileRow(model: SwapModel, vm: SwapViewModel, y: number): Container {
    return (
        <container x={MARGIN_PX} y={y}>
            <List length={() => model.tileCount}>
                {(index) => (
                    <container
                        x={() => vm.getX(index) + HALF_TILE_PX}
                        y={HALF_TILE_PX}
                        pivotX={HALF_TILE_PX}
                        pivotY={HALF_TILE_PX}
                        scale={() => vm.getScale(index)}
                        onPointerTap={() => model.swapWithNext(index)}
                    >
                        <graphics ref={drawTileFace} />
                        <text text={() => model.getTile(index).label} x={17} y={10} style={TILE_STYLE} />
                    </container>
                )}
            </List>
        </container>
    );
}

/**
 * The face is drawn once at construction, which is legal only because it is
 * identical for every tile. Everything tile-dependent is a getter. That is the
 * single authoring rule an index-addressed list imposes.
 */
function drawTileFace(g: Graphics): void {
    g.roundRect(0, 0, TILE_SIZE_PX, TILE_SIZE_PX, 8)
        .fill(0xf4efe4)
        .stroke({ color: 0x2b2b33, width: 2 });
}

const TILE_SIZE_PX = 48;
const HALF_TILE_PX = TILE_SIZE_PX / 2;
const TILE_PITCH_PX = 58;
const MARGIN_PX = 24;
const ROW_A_Y = 104;
const ROW_B_Y = 234;

const TILE_STYLE = { fill: 0x2b2b33, fontSize: 24, fontFamily: 'monospace', fontWeight: 'bold' };
const HEADING_STYLE = { fill: 0xe6edf3, fontSize: 15, fontFamily: 'monospace' };
const CAPTION_STYLE = { fill: 0x8b949e, fontSize: 12, fontFamily: 'monospace' };
