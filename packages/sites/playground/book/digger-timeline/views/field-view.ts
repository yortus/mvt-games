import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import type { DiggerModel, Facing } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FieldViewBindings {
    readonly model: DiggerModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The field of dirt with its tunnels, the digger, its harpoon, and a button
 * to fire it. The view knows nothing of the model's timelines. It reads the
 * digger's row and column, which may be fractional, and turns them into
 * pixels. Click a tile to send the digger there.
 */
export function FieldView({ model }: FieldViewBindings): Container {
    const view = new Container();
    const { rows, cols } = model;

    const hint = new Text({ text: 'Click a tile to dig there. Then press Step.', style: HINT_STYLE });
    hint.position.set(FIELD_X, 18);

    // Each tile is drawn once, in white, and tinted as dirt or tunnel
    const field = new Container();
    const tiles: Graphics[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const tile = new Graphics().rect(0, 0, TILE_PX, TILE_PX).fill(0xffffff);
            tile.position.set(FIELD_X + col * TILE_PX, FIELD_Y + row * TILE_PX);
            field.addChild(tile);
            tiles.push(tile);
        }
    }
    field.eventMode = 'static';
    field.cursor = 'pointer';
    field.hitArea = new Rectangle(FIELD_X, FIELD_Y, cols * TILE_PX, rows * TILE_PX);
    field.on('pointerdown', (e) => {
        const local = field.toLocal(e.global);
        model.walkTo(Math.floor((local.y - FIELD_Y) / TILE_PX), Math.floor((local.x - FIELD_X) / TILE_PX));
    });

    // The digger, drawn facing right, and turned to face its way. The
    // harpoon is drawn one tile long, and stretched to its length.
    const digger = new Container();
    const harpoon = new Graphics().rect(0, -2, TILE_PX, 4).fill(0xd8e0ea);
    const body = new Graphics()
        .circle(0, 0, TILE_PX * 0.38).fill(0xf2c14e)
        .rect(TILE_PX * 0.1, -TILE_PX * 0.12, TILE_PX * 0.32, TILE_PX * 0.24).fill(0x7fe0ff);
    digger.addChild(harpoon, body);

    const button = new Container();
    button.addChild(
        new Graphics().roundRect(0, 0, 96, 40, 8).fill(0x2a3550).stroke({ color: 0x5a6a90, width: 2 }),
        new Text({ text: 'Fire', x: 48, y: 20, anchor: 0.5, style: BUTTON_STYLE }),
    );
    button.position.set(FIELD_X + cols * TILE_PX + 16, FIELD_Y);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointerdown', model.fireHarpoon);

    view.addChild(hint, field, digger, button);
    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                tiles[row * cols + col].tint = model.isDugAt(row, col) ? TUNNEL_COLOR : DIRT_COLOR;
            }
        }
        digger.position.set(FIELD_X + (model.col + 0.5) * TILE_PX, FIELD_Y + (model.row + 0.5) * TILE_PX);
        digger.rotation = ROTATIONS[model.facing];
        harpoon.visible = model.harpoonLength > 0;
        harpoon.scale.x = model.harpoonLength;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The size of a tile, in pixels. */
const TILE_PX = 44;
/** Where the field's top left corner is. */
const FIELD_X = 24;
const FIELD_Y = 56;

const DIRT_COLOR = 0x8a5a2b;
const TUNNEL_COLOR = 0x241a14;

/** How far to turn the digger, drawn facing right, to face each way. */
const ROTATIONS: Readonly<Record<Facing, number>> = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
};

const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8b949e };
const BUTTON_STYLE = { fontFamily: 'monospace', fontSize: 16, fill: 0xe6edf3 };
