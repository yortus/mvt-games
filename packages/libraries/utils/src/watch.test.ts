import { describe, expect, expectTypeOf, it } from 'vitest';
import { watch } from './watch';

describe('watch', () => {
    describe('increased and decreased', () => {
        it('marks a rise as increased, and not decreased', () => {
            let count = 1;
            const watcher = watch({ count: () => count });
            watcher.poll();
            count = 3;
            const { count: watched } = watcher.poll();
            expect(watched.changed).toBe(true);
            expect(watched.increased).toBe(true);
            expect(watched.decreased).toBe(false);
        });

        it('marks a fall as decreased, and not increased', () => {
            let count = 3;
            const watcher = watch({ count: () => count });
            watcher.poll();
            count = 0;
            const { count: watched } = watcher.poll();
            expect(watched.changed).toBe(true);
            expect(watched.increased).toBe(false);
            expect(watched.decreased).toBe(true);
        });

        it('marks neither when nothing changed', () => {
            let count = 1;
            const watcher = watch({ count: () => count });
            watcher.poll();
            count = 2;
            watcher.poll();
            const { count: watched } = watcher.poll();
            expect(watched.changed).toBe(false);
            expect(watched.increased).toBe(false);
            expect(watched.decreased).toBe(false);
        });

        it('marks neither on the first poll, which has no previous value', () => {
            const watcher = watch({ count: () => 5 });
            const { count: watched } = watcher.poll();
            expect(watched.changed).toBe(true);
            expect(watched.previous).toBe(undefined);
            expect(watched.increased).toBe(false);
            expect(watched.decreased).toBe(false);
        });

        it('marks neither when a number is set again to the same number', () => {
            let count = 4;
            const watcher = watch({ count: () => count });
            watcher.poll();
            count = 4;
            const { count: watched } = watcher.poll();
            expect(watched.changed).toBe(false);
            expect(watched.increased).toBe(false);
            expect(watched.decreased).toBe(false);
        });

        it('marks neither when a value changes between a number and null', () => {
            // eslint-disable-next-line @mvtjs/no-null -- the test needs a value that compares as 0
            let level: number | null = null;
            const watcher = watch({ level: () => level });
            watcher.poll();
            level = 2;
            const watched = watcher.poll().level as unknown as { increased: boolean; decreased: boolean };
            expect(watched.increased).toBe(false);
            expect(watched.decreased).toBe(false);
        });

        it('gives them to numeric properties only', () => {
            const watcher = watch({
                count: () => 1,
                stage: () => 2 as 0 | 1 | 2,
                phase: () => 'playing' as 'playing' | 'dying',
                isAlive: () => true,
            });
            const w = watcher.poll();
            expectTypeOf(w.count.increased).toEqualTypeOf<boolean>();
            expectTypeOf(w.count.decreased).toEqualTypeOf<boolean>();
            expectTypeOf(w.stage.increased).toEqualTypeOf<boolean>();
            // @ts-expect-error - a string property has no `increased`
            void w.phase.increased;
            // @ts-expect-error - a string property has no `decreased`
            void w.phase.decreased;
            // @ts-expect-error - a boolean property has no `increased`
            void w.isAlive.increased;
        });
    });
});
