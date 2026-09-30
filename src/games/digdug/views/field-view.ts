import { Container, Graphics } from 'pixi.js';
import { watch } from '#mvt-utils';
import type { TileKind, DepthLayer } from '../data';
import type { GamePhase } from '../models';

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
    view.onRefresh = refresh;
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
                    // Tunnel - black background
                    gfx.rect(c * ts, r * ts, ts, ts).fill(0x000000);
                }
                else {
                    // Dirt - layered color
                    gfx.rect(c * ts, r * ts, ts, ts).fill(color);

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
