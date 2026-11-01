/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import type { TurnOrderModel } from '../models';
import { CardView } from './card-view';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** How far apart the cards' middles are, in pixels. Keep it wider than a card. */
const CARD_SPACING = 140;

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TableViewBindings {
    readonly model: TurnOrderModel;
    /** The size of the table, in pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A card for each player, in a row, with the card of the player whose turn
 * it is in gold. The cards are built in code, one for each player, and
 * placed in the tree as `{cards}`. Click a card to give that player the turn.
 */
export function TableView({ model, width, height }: TableViewBindings): Container {
    const count = model.players.length;
    const cards = model.players.map((name, player) => (
        <container cursor="pointer" onPointerTap={() => model.giveTurnTo(player)}>
            <CardView
                x={width / 2 + (player - (count - 1) / 2) * CARD_SPACING}
                y={height / 2}
                color={() => (model.currentPlayer === player ? GOLD : SLATE)}
                label={name}
            />
        </container>
    ));

    return (
        <container>
            {cards}
            <text text="Click a card to give that player the turn" anchor={0.5} x={width / 2} y={height - 30} style={HINT_STYLE} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const GOLD = 0xf2c14e;
const SLATE = 0x8a9bb0;
const HINT_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0x8fbfa0 };
