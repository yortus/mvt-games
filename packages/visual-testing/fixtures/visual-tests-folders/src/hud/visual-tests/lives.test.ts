import { Graphics } from 'pixi.js';
import { describe } from 'vitest';
import { canvasTest } from '@mvtjs/visual-testing';

describe('Lives', () => {
    canvasTest('three left', () => new Graphics().circle(6, 6, 5).circle(20, 6, 5).circle(34, 6, 5).fill(0xff4f8b));
});
