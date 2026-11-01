import type { Graphics } from 'pixi.js';

/**
 * Draws a chequered grid of tiles, with a small gap between them, and the
 * middle of its top edge at the origin.
 */
export function drawGrid(grid: Graphics, rows: number, cols: number, tileSize: number): void {
    grid.clear();
    const left = -(cols * tileSize) / 2;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const color = (row + col) % 2 === 0 ? 0x3a5a8c : 0x2a4068;
            grid.rect(left + col * tileSize, row * tileSize, tileSize - 2, tileSize - 2).fill(color);
        }
    }
}
