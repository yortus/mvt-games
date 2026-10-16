import { Container, Graphics } from 'pixi.js';
import { watch } from '@mvtjs/utils';
import type { TileKind, DepthLayer } from '../data';
import type { GamePhase } from '../models';
import { setRefresh } from '@mvtjs/pixi';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FieldViewBindings {
    tileSize: () => number;
    rows: () => number;
    cols: () => number;
    tileKindAt: (row: number, col: number) => TileKind;
    depthLayers: () => readonly DepthLayer[];
    tunnelCount: () => number;
    gamePhase: () => GamePhase;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

const SKY_COLOR = 0x44aaff;
const TUNNEL_COLOR = 0x120e0c;

export function FieldView(bindings: FieldViewBindings): Container {
    const watcher = watch({
        rows: bindings.rows,
        cols: bindings.cols,
        tileSize: bindings.tileSize,
        phase: bindings.gamePhase,
        tunnelCount: bindings.tunnelCount,
    });

    let gfx: Graphics;

    const view = new Container();
    initialiseView();
    setRefresh(view, refresh);
    return view;

    function initialiseView(): void {
        gfx = new Graphics();
        view.addChild(gfx);
    }

    function refresh(): void {
        const watched = watcher.poll();
        const dimsChanged = watched.rows.changed || watched.cols.changed || watched.tileSize.changed;

        if (
            dimsChanged
            || (watched.phase.changed && watched.phase.value === 'playing')
            || watched.tunnelCount.changed
        ) {
            buildField();
        }
    }

    function buildField(): void {
        gfx.clear();
        const rows = bindings.rows();
        const cols = bindings.cols();
        const ts = bindings.tileSize();
        const layers = bindings.depthLayers();

        // Surface row - sky
        gfx.rect(0, 0, cols * ts, ts).fill(SKY_COLOR);

        // Dirt layers and tunnels
        for (let r = 1; r < rows; r++) {
            // Find layer color for this row
            let color = 0x8b5e3c;
            for (let l = 0; l < layers.length; l++) {
                if (r >= layers[l].startRow && r <= layers[l].endRow) {
                    color = layers[l].color;
                    break;
                }
            }

            for (let c = 0; c < cols; c++) {
                const kind = bindings.tileKindAt(r, c);
                if (kind === 'tunnel') {
                    gfx.rect(c * ts, r * ts, ts, ts).fill(TUNNEL_COLOR);
                }
                else {
                    // Dirt - layered color
                    gfx.rect(c * ts, r * ts, ts, ts).fill(color);

                    // A stone fleck in most tiles, placed by a hash of the tile
                    // so it stays put when the field is rebuilt
                    const hash = tileHash(r, c);
                    if ((hash & 3) !== 0) {
                        const fx = c * ts + ((hash >>> 2) % (ts - 3));
                        const fy = r * ts + ((hash >>> 8) % (ts - 3));
                        gfx.rect(fx, fy, 2, 2).fill({ color: 0xffffff, alpha: 0.25 });
                    }

                    // Subtle texture lines at layer boundaries
                    if (r > 1 && layers.length > 0) {
                        for (let l = 0; l < layers.length; l++) {
                            if (r === layers[l].startRow) {
                                gfx.rect(c * ts, r * ts, ts, 2).fill({ color: 0x000000, alpha: 0.15 });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A small integer hash of a tile's position. */
function tileHash(row: number, col: number): number {
    let h = Math.imul(row, 0x27d4eb2d) ^ Math.imul(col, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    return (h ^ (h >>> 13)) >>> 0;
}
