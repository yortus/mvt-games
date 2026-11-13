import { describe, expect, it } from 'vitest';
import { LEVEL_SETTINGS, createGlassWindow } from '../models';
import { measureTurn } from './measure-turn';

describe('measureTurn', () => {
    // A thin and a fat rhombus in the Penrose tiling, and squares among the 8-fold tiling's tiles
    for (const symmetry of [5, 8, 12]) {
        it(`turns each tile onto every other of its shape, ${symmetry}-fold, by no more than a quarter turn`, () => {
            const settings = { ...LEVEL_SETTINGS.easy, symmetries: [symmetry] };
            const { patch } = createGlassWindow({ seed: 3, settings, frame: 'octagon' });
            const wrong: string[] = [];
            for (let from = 0; from < patch.count; from++) {
                for (let to = 0; to < patch.count; to++) {
                    // Whole tiles, whose corners show the turn. The frame's trimmed tiles turn as their rhombuses do
                    if (patch.cuts[from] === 1 || patch.cuts[to] === 1 || patch.trims[from] === 1 || patch.trims[to] === 1) continue;
                    if (patch.shapes[from] !== patch.shapes[to]) continue;
                    const turn = measureTurn(patch, from, to);
                    if (Math.abs(turn) > Math.PI / 2 + 1e-9 || !isTurnedOnto(from, to, turn)) wrong.push(`${from} onto ${to}: ${turn}`);
                }
            }
            expect(wrong).toEqual([]);

            /** Whether `from`'s corners, turned about its middle and moved to `to`'s, land on `to`'s corners. */
            function isTurnedOnto(from: number, to: number, turn: number): boolean {
                const cos = Math.cos(turn);
                const sin = Math.sin(turn);
                for (let i = 0; i < 4; i++) {
                    const x = patch.cornerXs[patch.cornerStarts[from] + i] - patch.middleXs[from];
                    const y = patch.cornerYs[patch.cornerStarts[from] + i] - patch.middleYs[from];
                    const turnedX = patch.middleXs[to] + x * cos - y * sin;
                    const turnedY = patch.middleYs[to] + x * sin + y * cos;
                    let isOnCorner = false;
                    for (let j = 0; j < 4; j++) {
                        const at = patch.cornerStarts[to] + j;
                        if (Math.hypot(turnedX - patch.cornerXs[at], turnedY - patch.cornerYs[at]) < 1e-6) isOnCorner = true;
                    }
                    if (!isOnCorner) return false;
                }
                return true;
            }
        });
    }
});
