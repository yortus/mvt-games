import { describe, it, expect } from 'vitest';
import { createWorldModel } from './world-model';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createWorldModel', () => {
    it('starts populated with entities placed on distinct cells', () => {
        const model = createWorldModel();
        expect(model.entityCount).toBeGreaterThan(0);
        expectDistinctCells(model);
    });

    describe('revision triggers', () => {
        it('spawn bumps grid, roster, and active revisions and adds an entity', () => {
            const model = createWorldModel();
            const before = snapshot(model);
            const count = model.entityCount;

            model.spawn();

            expect(model.entityCount).toBe(count + 1);
            expect(model.gridRevision).toBeGreaterThan(before.grid);
            expect(model.rosterRevision).toBeGreaterThan(before.roster);
            expect(model.activeRevision).toBeGreaterThan(before.active);
        });

        it('removeOne bumps grid, roster, and active revisions and drops an entity', () => {
            const model = createWorldModel();
            const before = snapshot(model);
            const count = model.entityCount;

            model.removeOne();

            expect(model.entityCount).toBe(count - 1);
            expect(model.gridRevision).toBeGreaterThan(before.grid);
            expect(model.rosterRevision).toBeGreaterThan(before.roster);
            expect(model.activeRevision).toBeGreaterThan(before.active);
        });

        it('retypeOne bumps grid and roster, but not active', () => {
            const model = createWorldModel();
            const before = snapshot(model);

            model.retypeOne();

            expect(model.gridRevision).toBeGreaterThan(before.grid);
            expect(model.rosterRevision).toBeGreaterThan(before.roster);
            expect(model.activeRevision).toBe(before.active);
        });

        it('moveOne bumps grid only', () => {
            const model = createWorldModel();
            const before = snapshot(model);

            model.moveOne();

            expect(model.gridRevision).toBeGreaterThan(before.grid);
            expect(model.rosterRevision).toBe(before.roster);
            expect(model.activeRevision).toBe(before.active);
        });

        it('toggleActiveOne bumps active only', () => {
            const model = createWorldModel();
            const before = snapshot(model);

            model.toggleActiveOne();

            expect(model.gridRevision).toBe(before.grid);
            expect(model.rosterRevision).toBe(before.roster);
            expect(model.activeRevision).toBeGreaterThan(before.active);
        });
    });

    describe('update', () => {
        it('advances continuous phase', () => {
            const model = createWorldModel();
            const before = model.phase;
            model.update(16);
            expect(model.phase).toBeGreaterThan(before);
        });

        it('does not churn when autoChurn is off', () => {
            const model = createWorldModel();
            model.autoChurn = false;
            const before = snapshot(model);
            for (let i = 0; i < 200; i++) model.update(16);
            expect(model.gridRevision).toBe(before.grid);
            expect(model.rosterRevision).toBe(before.roster);
            expect(model.activeRevision).toBe(before.active);
        });

        it('keeps entities on distinct cells through sustained churn', () => {
            const model = createWorldModel();
            for (let i = 0; i < 600; i++) {
                model.update(16);
                expectDistinctCells(model);
            }
        });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshot(model: ReturnType<typeof createWorldModel>): { grid: number; roster: number; active: number } {
    return { grid: model.gridRevision, roster: model.rosterRevision, active: model.activeRevision };
}

function expectDistinctCells(model: ReturnType<typeof createWorldModel>): void {
    const seen = new Set<number>();
    for (let i = 0; i < model.entityCount; i++) {
        const e = model.getEntity(i);
        const cell = e.row * model.cols + e.col;
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
    }
}
