/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import type { GameModel } from '../models';
import { DotsView } from './dots-view';
import { HudView } from './hud-view';
import { KeyboardInputView } from './keyboard-input-view';
import { MinimapView } from './minimap-view';
import { ShipView } from './ship-view';
import { SpikesView } from './spikes-view';
import { WallsView } from './walls-view';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GameViewBindings {
    readonly model: GameModel;
    /** Whether one of the child views shows. */
    readonly isShown: (part: GameViewPart) => boolean;
}

/** A child view that GameView can show or hide. */
export type GameViewPart = 'walls' | 'dots' | 'spikes' | 'ship' | 'hud' | 'minimap';

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The game's top-level view, and the only one that knows the model. It
 * builds each child, and wires the child's bindings to the model, so all
 * the wiring is here. The children know only their own bindings.
 *
 * The grid is three children, one for each layer, stacked in order: the
 * walls, then the dots, then the spikes. Each asks one question of a cell,
 * and the wiring answers it from the grid's kind of tile.
 *
 * Each child sits in a container whose `visible` getter asks whether that
 * child is shown, so the example's buttons can hide it. A hidden child
 * isn't refreshed at all, and the model carries on as before.
 */
export function GameView(bindings: GameViewBindings): Container {
    const { model, isShown } = bindings;
    const { grid } = model;
    return (
        <container>
            <container y={HUD_HEIGHT}>
                <container visible={() => isShown('walls')}>
                    <WallsView
                        rows={grid.rows}
                        cols={grid.cols}
                        isWallAt={(row, col) => grid.tileKindAt(row, col) === 'wall'}
                    />
                </container>
                <container visible={() => isShown('dots')}>
                    <DotsView
                        rows={grid.rows}
                        cols={grid.cols}
                        hasDotAt={(row, col) => grid.tileKindAt(row, col) === 'dot'}
                    />
                </container>
                <container visible={() => isShown('spikes')}>
                    <SpikesView
                        rows={grid.rows}
                        cols={grid.cols}
                        hasSpikeAt={(row, col) => grid.tileKindAt(row, col) === 'spike'}
                    />
                </container>
                <container visible={() => isShown('ship')}>
                    <ShipView
                        row={() => model.player.row}
                        col={() => model.player.col}
                    />
                </container>
            </container>
            <container visible={() => isShown('hud')}>
                <HudView
                    score={() => model.score}
                    lives={() => model.lives}
                />
            </container>
            {/* The new view. No other view, and no model, changed for it. */}
            <container x={MINIMAP_X} y={HUD_HEIGHT} visible={() => isShown('minimap')}>
                <MinimapView
                    rows={grid.rows}
                    cols={grid.cols}
                    tileKindAt={(row, col) => grid.tileKindAt(row, col)}
                    shipRow={() => model.player.row}
                    shipCol={() => model.player.col}
                />
            </container>
            <KeyboardInputView
                onDirectionPressed={(dir) => model.player.turnTo(dir)}
            />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How tall the HUD is, above the grid, in pixels. */
const HUD_HEIGHT = 36;
/** Where the minimap goes, to the right of the grid, in pixels. */
const MINIMAP_X = 462;
