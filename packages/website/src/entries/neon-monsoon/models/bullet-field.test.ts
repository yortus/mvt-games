import { describe, expect, it } from 'vitest';
import { createBulletField } from './bullet-field';

type TestKind = 'small' | 'large';

function makeField(capacity = 8) {
    return createBulletField<TestKind>({
        capacity,
        hitRadii: { small: 1, large: 5 },
        width: 100,
        height: 100,
        margin: 10,
    });
}

const STRAIGHT = { speed: 100 };
const DOWN = Math.PI / 2;
const RIGHT = 0;

describe('BulletField', () => {
    describe('fire', () => {
        it('adds a bullet with the given position, angle and kind', () => {
            const field = makeField();
            expect(field.fire(10, 20, DOWN, 'large', STRAIGHT)).toBe(true);
            expect(field.count).toBe(1);
            expect(field.xOf(0)).toBe(10);
            expect(field.yOf(0)).toBe(20);
            expect(field.angleOf(0)).toBe(DOWN);
            expect(field.kindOf(0)).toBe('large');
            expect(field.ageOf(0)).toBe(0);
        });

        it('drops a bullet when full, rather than failing', () => {
            const field = makeField(2);
            field.fire(0, 0, DOWN, 'small', STRAIGHT);
            field.fire(0, 0, DOWN, 'small', STRAIGHT);
            expect(field.fire(0, 0, DOWN, 'small', STRAIGHT)).toBe(false);
            expect(field.count).toBe(2);
        });

        it('scales the speed', () => {
            const field = makeField();
            field.fire(0, 0, RIGHT, 'small', STRAIGHT, 2);
            field.update(100);
            expect(field.xOf(0)).toBeCloseTo(20);
        });
    });

    describe('update', () => {
        it('moves bullets along their angle and ages them', () => {
            const field = makeField();
            field.fire(50, 10, DOWN, 'small', STRAIGHT);
            field.update(100);
            expect(field.xOf(0)).toBeCloseTo(50);
            expect(field.yOf(0)).toBeCloseTo(20);
            expect(field.ageOf(0)).toBe(100);
        });

        it('eases speed toward endSpeed at accel', () => {
            const field = makeField();
            field.fire(0, 50, RIGHT, 'small', { speed: 0, endSpeed: 40, accel: 40 });
            field.update(500);
            // Speed reaches 20 in the first half second, then the bullet moves at that speed.
            expect(field.xOf(0)).toBeCloseTo(10);
            // Then it reaches 40, and stays there.
            field.update(1000);
            field.update(100);
            expect(field.xOf(0)).toBeCloseTo(10 + 40 + 4);
        });

        it('turns for turnMs, then flies straight', () => {
            const field = makeField();
            field.fire(50, 50, RIGHT, 'small', { speed: 0, turnDegPerSec: 90, turnMs: 500 });
            for (let i = 0; i < 10; i++) field.update(100);
            expect(field.angleOf(0)).toBeCloseTo(Math.PI / 4);
        });

        it('removes bullets that leave the arena by more than the margin', () => {
            const field = makeField();
            field.fire(50, 105, DOWN, 'small', STRAIGHT);
            field.fire(50, 50, DOWN, 'small', STRAIGHT);
            field.update(100);
            expect(field.count).toBe(1);
            expect(field.yOf(0)).toBeCloseTo(60);
        });
    });

    describe('remove', () => {
        it('moves the last bullet into the gap, keeping every other bullet', () => {
            const field = makeField();
            field.fire(1, 0, DOWN, 'small', STRAIGHT);
            field.fire(2, 0, DOWN, 'large', STRAIGHT);
            field.fire(3, 0, DOWN, 'small', STRAIGHT);
            field.remove(0);
            expect(field.count).toBe(2);
            expect(field.xOf(0)).toBe(3);
            expect(field.xOf(1)).toBe(2);
            expect(field.kindOf(1)).toBe('large');
        });
    });

    describe('clear', () => {
        it('removes every bullet, reporting where each was', () => {
            const field = makeField();
            field.fire(1, 2, DOWN, 'small', STRAIGHT);
            field.fire(3, 4, DOWN, 'small', STRAIGHT);
            const seen: number[] = [];
            field.clear((x, y) => seen.push(x, y));
            expect(field.count).toBe(0);
            expect(seen).toEqual([1, 2, 3, 4]);
        });
    });

    describe('findTouching', () => {
        it('finds a bullet within the radius plus its own hit radius', () => {
            const field = makeField();
            field.fire(50, 50, DOWN, 'large', STRAIGHT);
            expect(field.findTouching(50, 57, 2.5)).toBe(0);
            expect(field.findTouching(50, 58, 2.5)).toBe(-1);
        });
    });

    describe('markGrazed', () => {
        it('counts each bullet once, however long it stays close', () => {
            const field = makeField();
            field.fire(50, 50, DOWN, 'small', { speed: 0 });
            field.fire(90, 90, DOWN, 'small', { speed: 0 });
            expect(field.markGrazed(50, 55, 10)).toBe(1);
            expect(field.markGrazed(50, 55, 10)).toBe(0);
        });

        it('keeps the grazed mark with the bullet when it moves index', () => {
            const field = makeField();
            field.fire(0, 0, DOWN, 'small', { speed: 0 });
            field.fire(50, 50, DOWN, 'small', { speed: 0 });
            field.markGrazed(50, 50, 5);
            field.remove(0);
            expect(field.markGrazed(50, 50, 5)).toBe(0);
        });
    });
});
