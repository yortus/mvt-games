import { Container, Graphics } from 'pixi.js';
import { createPanelView } from './panel-view';
import { CODE_COLORS } from '../constants';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface GridViewBindings {
    /** Dense grid of kind codes (0 = empty), length rows * cols. */
    getGrid(): Uint8Array;
    getRows(): number;
    getCols(): number;
    /** Continuous phase (radians) driving the cosmetic brightness pulse. */
    getPhase(): number;
    getRecomputes(): number;
    getFlash(): number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GridViewOptions extends GridViewBindings {
    width: number;
    height: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGridView(options: GridViewOptions): Container {
    const { getGrid, getRows, getCols, getPhase, getRecomputes, getFlash } = options;

    const panel = createPanelView({
        width: options.width,
        height: options.height,
        title: 'Occupancy grid',
        subtitle: 'sparse \u2192 dense reshape',
        getRecomputes,
        getFlash,
    });

    const cells = new Graphics();
    panel.content.addChild(cells);
    panel.content.onRender = refresh;

    return panel.view;

    // ---- Refresh -----------------------------------------------------------

    function refresh(): void {
        const grid = getGrid();
        const rows = getRows();
        const cols = getCols();
        const phase = getPhase();

        const cw = panel.contentWidth;
        const ch = panel.contentHeight;
        if (cols === 0 || rows === 0) return;

        const cell = Math.min(cw / cols, ch / rows);
        const gridW = cell * cols;
        const gridH = cell * rows;
        const ox = (cw - gridW) / 2;
        const oy = (ch - gridH) / 2;
        const gap = Math.max(1, cell * 0.09);

        cells.clear();
        cells.roundRect(ox, oy, gridW, gridH, 4).fill({ color: 0x10141b });

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const code = grid[r * cols + c];
                if (code === 0) continue;
                // Colour comes from the derived grid; brightness is read directly
                // every frame from the continuous phase (never derived).
                const brightness = 0.7 + 0.3 * Math.sin(phase + (r * cols + c) * 0.35);
                const x = ox + c * cell + gap;
                const y = oy + r * cell + gap;
                const size = cell - gap * 2;
                cells.roundRect(x, y, size, size, Math.min(4, size * 0.28))
                    .fill({ color: CODE_COLORS[code], alpha: brightness });
            }
        }
    }
}
