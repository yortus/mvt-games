import { describe, expect, it } from 'vitest';
import { createRandom } from './random';
import { type DigOrderKind, writeDigOrder } from './write-dig-order';

const KINDS: readonly DigOrderKind[] = ['random', 'every-other', 'snake', 'reading'];

describe('the dig orders', () => {
    for (const kind of KINDS) {
        it(`visits every cell once, in the ${kind} order`, () => {
            expect([...write(kind)].sort((a, b) => a - b)).toEqual(range(81));
        });
    }

    it('reads each row left to right, from the top', () => {
        expect([...write('reading')]).toEqual(range(81));
    });

    it('snakes: left to right along the first row, then right to left along the second', () => {
        const order = write('snake');
        expect([...order.subarray(0, 9)]).toEqual(range(9));
        expect([...order.subarray(9, 18)]).toEqual(range(9).map((i) => 17 - i));
    });

    it('takes every other cell along the snake, then the cells it skipped', () => {
        const snake = write('snake');
        const order = write('every-other');
        expect(order[0]).toBe(snake[0]);
        expect(order[1]).toBe(snake[2]);
        expect(order[41]).toBe(snake[1]);
    });

    it('shuffles the random order differently for each seed', () => {
        expect([...write('random', 1)]).not.toEqual([...write('random', 2)]);
        expect([...write('random', 1)]).toEqual([...write('random', 1)]);
    });
});

function write(kind: DigOrderKind, seed = 1): Uint8Array {
    const order = new Uint8Array(81);
    writeDigOrder(order, kind, createRandom({ seed }));
    return order;
}

function range(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
}
