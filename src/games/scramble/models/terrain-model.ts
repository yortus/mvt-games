import type { SectionProfile } from '../data';
import type { TileKind } from './common';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface TerrainModel {
    /** Total number of columns across all sections. */
    readonly totalCols: number;
    /** Number of tile rows. */
    readonly rows: number;
    /** Return the tile kind at the given world column and row. */
    getTile(col: number, row: number): TileKind;
    /** Return true if the tile at the given position is solid. */
    isSolid(col: number, row: number): boolean;
    /** Return the section index (0-based) for the given world column. */
    getSectionIndex(col: number): number;
    /** Return the row of the first empty tile above the floor at the given column. */
    getSurfaceRow(col: number): number;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TerrainModelOptions {
    readonly sections: readonly SectionProfile[];
    readonly rows: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTerrainModel(options: TerrainModelOptions): TerrainModel {
    const { sections, rows } = options;

    // Calculate total columns and section start offsets
    let totalCols = 0;
    const sectionStarts: number[] = [];
    for (let s = 0; s < sections.length; s++) {
        sectionStarts.push(totalCols);
        totalCols += sections[s].floor.length;
    }

    // Expand height profiles into a flat tile grid (column-major: col * rows + row)
    const tiles = new Uint8Array(totalCols * rows);
    let colOffset = 0;
    for (let s = 0; s < sections.length; s++) {
        const section = sections[s];
        const sectionCols = section.floor.length;
        for (let c = 0; c < sectionCols; c++) {
            const worldCol = colOffset + c;
            const floorH = section.floor[c];
            const ceilH = section.ceiling[c];
            const base = worldCol * rows;
            // Ceiling tiles (top)
            for (let r = 0; r < ceilH; r++) {
                tiles[base + r] = 1;
            }
            // Floor tiles (bottom)
            for (let r = rows - floorH; r < rows; r++) {
                tiles[base + r] = 1;
            }
        }
        colOffset += sectionCols;
    }

    const model: TerrainModel = {
        totalCols,
        rows,

        getTile(col: number, row: number): TileKind {
            if (col < 0 || col >= totalCols || row < 0 || row >= rows) return 'empty';
            return tiles[col * rows + row] ? 'solid' : 'empty';
        },

        isSolid(col: number, row: number): boolean {
            if (col < 0 || col >= totalCols || row < 0 || row >= rows) return false;
            return tiles[col * rows + row] === 1;
        },

        getSectionIndex(col: number): number {
            for (let s = sectionStarts.length - 1; s >= 0; s--) {
                if (col >= sectionStarts[s]) return s;
            }
            return 0;
        },

        getSurfaceRow(col: number): number {
            if (col < 0 || col >= totalCols) return rows - 1;
            const base = col * rows;
            // Scan upward from the bottom to find the first empty tile
            for (let r = rows - 1; r >= 0; r--) {
                if (tiles[base + r] === 0) return r;
            }
            return 0;
        },

        update(_deltaMs: number): void {
            // Terrain is static
        },
    };

    return model;
}
