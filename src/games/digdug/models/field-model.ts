import type { TileKind } from '../data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FieldModel {
    readonly rows: number;
    readonly cols: number;
    tileAt(row: number, col: number): TileKind;
    isDirt(row: number, col: number): boolean;
    isTunnel(row: number, col: number): boolean;
    isSurface(row: number, col: number): boolean;
    isWalkable(row: number, col: number): boolean;
    dig(row: number, col: number): void;
    readonly tunnelCount: number;
    reset(layout: readonly TileKind[]): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FieldModelOptions {
    rows: number;
    cols: number;
    layout: readonly TileKind[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFieldModel(options: FieldModelOptions): FieldModel {
    const { rows, cols } = options;

    // Own the data - clone the input layout
    const tiles: TileKind[] = new Array(rows * cols);
    let tunnels = 0;

    function loadLayout(layout: readonly TileKind[]): void {
        tunnels = 0;
        for (let i = 0; i < rows * cols; i++) {
            tiles[i] = layout[i];
            if (layout[i] === 'tunnel') tunnels++;
        }
    }

    loadLayout(options.layout);

    const model: FieldModel = {
        rows,
        cols,

        tileAt(row: number, col: number): TileKind {
            if (row < 0 || row >= rows || col < 0 || col >= cols) {
                return 'dirt'; // treat out-of-bounds as solid
            }
            return tiles[row * cols + col];
        },

        isDirt(row: number, col: number): boolean {
            return model.tileAt(row, col) === 'dirt';
        },

        isTunnel(row: number, col: number): boolean {
            return model.tileAt(row, col) === 'tunnel';
        },

        isSurface(row: number, col: number): boolean {
            return model.tileAt(row, col) === 'surface';
        },

        isWalkable(row: number, col: number): boolean {
            if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
            const kind = tiles[row * cols + col];
            return kind === 'tunnel' || kind === 'surface';
        },

        dig(row: number, col: number): void {
            if (row < 0 || row >= rows || col < 0 || col >= cols) return;
            const idx = row * cols + col;
            if (tiles[idx] === 'dirt') {
                tiles[idx] = 'tunnel';
                tunnels++;
            }
        },

        get tunnelCount(): number {
            return tunnels;
        },

        reset(layout: readonly TileKind[]): void {
            loadLayout(layout);
        },

        update(_deltaMs: number): void {
            // Field is static - mutations happen via dig()
        },
    };

    return model;
}
