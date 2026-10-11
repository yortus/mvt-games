// Two test files share this folder, and so do their reference images.
import { Graphics } from 'pixi.js';
import { describe } from 'vitest';
import { canvasTest } from 'vsnap';

describe('Score', () => {
    canvasTest('empty', () => new Graphics().rect(0, 0, 40, 8).stroke({ width: 2, color: 0xffffff }));
    canvasTest('half full', () => new Graphics().rect(0, 0, 40, 8).stroke({ width: 2, color: 0xffffff }).rect(0, 0, 20, 8).fill(0x2fd27a));
});
