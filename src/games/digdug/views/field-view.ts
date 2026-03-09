import { Container, Graphics } from 'pixi.js';
import { createWatch } from '#utils';
import type { TileKind, DepthLayer } from '../data';
import type { GamePhase } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface FieldViewBindings {
    getTileSize(): number;
    getRows(): number;
    getCols(): number;
    getTileKind(row: number, col: number): TileKind;
    getDepthLayers(): readonly DepthLayer[];
    getTunnelCount(): number;
    getGamePhase(): GamePhase;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const SKY_COLOR = 0x44aaff;

export function createFieldView(bindings: FieldViewBindings): Container {
    const watchRows = createWatch(bindings.getRows);
    const watchCols = createWatch(bindings.getCols);
    const watchTileSize = createWatch(bindings.getTileSize);
    const watchPhase = createWatch(bindings.getGamePhase);
    const watchTunnelCount = createWatch(bindings.getTunnelCount);

    const container = new Container();
    const gfx = new Graphics();
    container.addChild(gfx);

    buildField();
    container.onRender = refresh;
    return container;

    function refresh(): void {
        const dimsChanged = watchRows.changed() | watchCols.changed() | watchTileSize.changed();
        const phaseChanged = watchPhase.changed();
        const tunnelsChanged = watchTunnelCount.changed();

        if (dimsChanged || (phaseChanged && watchPhase.value === 'playing') || tunnelsChanged) {
            buildField();
        }
    }

    function buildField(): void {
        gfx.clear();
        const rows = bindings.getRows();
        const cols = bindings.getCols();
        const ts = bindings.getTileSize();
        const layers = bindings.getDepthLayers();

        // Surface row — sky
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
                const kind = bindings.getTileKind(r, c);
                if (kind === 'tunnel') {
                    // Tunnel — black background
                    gfx.rect(c * ts, r * ts, ts, ts).fill(0x000000);
                } else {
                    // Dirt — layered color
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
