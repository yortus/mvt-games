import { describe, expect, expectTypeOf, it } from 'vitest';
import { changedFrom, decreased, increased } from './when-conditions';
import { createComputed, type Computed } from './computed';
import { createReaction } from './reaction';

describe('createReaction', () => {
    it('never reacts because it was made, only when it sees a change', () => {
        let phase = 'dying';
        const played: string[] = [];
        const playExplosionSoundWhenDying = createReaction({
            watch: () => phase,
            when: 'dying',
            react: () => played.push('explode'),
        });
        playExplosionSoundWhenDying();
        expect(played).toEqual([]);

        phase = 'respawning';
        playExplosionSoundWhenDying();
        phase = 'dying';
        playExplosionSoundWhenDying();
        expect(played).toEqual(['explode']);
    });

    it('sees a change made between construction and the first call', () => {
        let beats = 0;
        let heard = 0;
        const playBeatSoundOnEachBeat = createReaction({ watch: () => beats, when: increased, react: () => heard++ });
        beats = 1;
        playBeatSoundOnEachBeat();
        expect(heard).toBe(1);
    });

    it("reacts to every change when there's no `when`, with the value before", () => {
        let phase = 'a';
        const seen: string[] = [];
        const recordEachPhaseChange = createReaction({
            watch: () => phase,
            react: (current, previous) => seen.push(`${previous}>${current}`),
        });
        phase = 'b';
        recordEachPhaseChange();
        phase = 'c';
        recordEachPhaseChange();
        expect(seen).toEqual(['a>b', 'b>c']);
    });

    it('sees nothing on a second call in the same step', () => {
        let spins = 0;
        let count = 0;
        const playLeverSoundOnEachSpin = createReaction({ watch: () => spins, when: increased, react: () => count++ });
        spins = 1;
        playLeverSoundOnEachSpin();
        playLeverSoundOnEachSpin();
        expect(count).toBe(1);
    });

    it('misses a change that reverts between two calls', () => {
        let lives = 3;
        let flashes = 0;
        const flashLivesWhenLivesChange = createReaction({ watch: () => lives, react: () => flashes++ });
        lives = 2;
        lives = 3;
        flashLivesWhenLivesChange();
        expect(flashes).toBe(0);
    });

    it('can play once for each shot it missed, from previous to current', () => {
        let shots = 0;
        let fired = 0;
        const playShotSoundForEachShot = createReaction({
            watch: () => shots,
            when: increased,
            react: (current, previous) => {
                for (let i = previous; i < current; i++) fired++;
            },
        });
        shots = 3;
        playShotSoundForEachShot();
        expect(fired).toBe(3);
    });

    it('takes increased, decreased and changedFrom as conditions', () => {
        let count = 5;
        let phase = 'playing';
        const heard: string[] = [];
        const reactions = [
            createReaction({ watch: () => count, when: increased, react: () => heard.push('up') }),
            createReaction({ watch: () => count, when: decreased, react: () => heard.push('down') }),
            createReaction({ watch: () => phase, when: changedFrom('dying'), react: () => heard.push('revived') }),
        ];
        const step = (): void => {
            for (let i = 0; i < reactions.length; i++) reactions[i]();
        };
        count = 7;
        step();
        count = 2;
        phase = 'dying';
        step();
        phase = 'respawning';
        step();
        expect(heard).toEqual(['up', 'down', 'revived']);
    });

    it('combines conditions by hand', () => {
        let phase = 'playing';
        const heard: string[] = [];
        const playLossSoundWhenDyingOrGameOver = createReaction({
            watch: () => phase,
            when: (current) => current === 'dying' || current === 'game-over',
            react: () => heard.push('loss'),
        });
        for (const next of ['respawning', 'dying', 'respawning', 'game-over']) {
            phase = next;
            playLossSoundWhenDyingOrGameOver();
        }
        expect(heard).toEqual(['loss', 'loss']);
    });

    it('compares with ===, so a watched NaN reacts on every call', () => {
        let reacted = 0;
        const countEachChange = createReaction({ watch: () => Number.NaN, react: () => reacted++ });
        countEachChange();
        countEachChange();
        expect(reacted).toBe(2);
    });

    it('watches a bigint, and knows which way it moved', () => {
        let total = 10n;
        let rises = 0;
        const playRiseSoundWhenTotalRises = createReaction({
            watch: () => total,
            when: increased,
            react: () => rises++,
        });
        total = 11n;
        playRiseSoundWhenTotalRises();
        total = 9n;
        playRiseSoundWhenTotalRises();
        expect(rises).toBe(1);
    });

    it('reacts to each getter of an array separately, in index order, with its index', () => {
        const phases = ['spinning', 'spinning', 'spinning'];
        const stops: number[] = [];
        const playStopSoundWhenEachReelSettles = createReaction({
            watch: phases.map((_, i) => () => phases[i]),
            when: 'settling',
            react: (_current, _previous, index) => stops.push(index),
        });
        phases[1] = 'settling';
        playStopSoundWhenEachReelSettles();
        phases[2] = 'settling';
        phases[0] = 'settling';
        playStopSoundWhenEachReelSettles();
        expect(stops).toEqual([1, 0, 2]);
    });

    it("gives an array's `when` the index too", () => {
        const counts = [0, 0];
        const heard: number[] = [];
        const recordChangesToSecondCount = createReaction({
            watch: counts.map((_, i) => () => counts[i]),
            when: (_current, _previous, index) => index === 1,
            react: (_current, _previous, index) => heard.push(index),
        });
        counts[0] = 1;
        counts[1] = 1;
        recordChangesToSecondCount();
        expect(heard).toEqual([1]);
    });

    it('does nothing for an array that is empty at run time', () => {
        const getters: (() => number)[] = [];
        let reacted = 0;
        const countEachChange = createReaction({ watch: getters, react: () => reacted++ });
        countEachChange();
        expect(reacted).toBe(0);
    });

    it('reacts to a computed primitive by its value', () => {
        let isActive = false;
        let level = 1;
        let alarms = 0;
        const isInDanger = createComputed({
            watch: { isActive: () => isActive, level: () => level },
            compute: (v) => v.isActive && v.level > 3,
        });
        const playAlarmSoundWhenInDanger = createReaction({ watch: isInDanger, when: true, react: () => alarms++ });
        isActive = true;
        playAlarmSoundWhenInDanger();
        level = 5;
        playAlarmSoundWhenInDanger();
        level = 6;
        playAlarmSoundWhenInDanger();
        expect(alarms).toBe(1);
    });

    it("reacts to a computed object's version", () => {
        let size = 1;
        let layouts = 0;
        const cells = createComputed({
            watch: () => size,
            compute: (n, array: number[] = []) => {
                array.length = n;
                return array;
            },
        });
        const layOutWhenCellsChange = createReaction({ watch: () => cells.version, react: () => layouts++ });
        size = 2;
        layOutWhenCellsChange();
        layOutWhenCellsChange();
        expect(layouts).toBe(1);
    });

    it('throws on `when: undefined`, which would quietly mean any change', () => {
        const level = (): number | undefined => 1;
        expect(() => createReaction({ watch: level, when: undefined, react: () => {} })).toThrow(/`when: undefined`/);
    });

    it('throws on a record, saying to compute one value from it', () => {
        // @ts-expect-error: a record is for createComputed and watch.
        expect(() => createReaction({ watch: { a: () => 1 }, react: () => {} })).toThrow(/compute one value/);
    });

    it('throws on a getter that returns an object', () => {
        // @ts-expect-error: an array can't be watched.
        expect(() => createReaction({ watch: () => [1, 2], react: () => {} })).toThrow(/gave an array/);
    });

    it('throws when a getter starts returning an object, in production too', () => {
        let value: unknown = 1;
        const reaction = createReaction({ watch: () => value as number, react: () => {} });
        value = { score: 1 };
        expect(() => reaction()).toThrow(/createReaction: watch gave an object/);
    });

    it('throws on an array element that is not a getter', () => {
        // @ts-expect-error: every element must be a getter.
        expect(() => createReaction({ watch: [() => 1, 2], react: () => {} })).toThrow(/watch\[1\] must be a getter/);
    });

    describe('types', () => {
        it('infers what each shape gives, and refuses mistakes', () => {
            // Declarations for the type checker only: this function is never called.
            /* eslint-disable @mvtjs/no-unused-watch -- declarations only, never run */
            const declareTests = (fixtures: Fixtures): void => {
                const { bindings, model, scoreText, cells, reelPhase } = fixtures;

                // One getter
                createReaction({
                    watch: bindings.phase,
                    when: 'dying',
                    react: (current, previous) => {
                        expectTypeOf(current).toEqualTypeOf<GamePhase>();
                        expectTypeOf(previous).toEqualTypeOf<GamePhase>();
                    },
                });
                createReaction({
                    watch: bindings.spins,
                    when: increased,
                    react: (current) => expectTypeOf(current).toEqualTypeOf<number>(),
                });
                createReaction({ watch: bindings.total, when: decreased, react: () => {} });
                createReaction({ watch: bindings.phase, when: changedFrom('dying'), react: () => {} });
                const isBigRise = (level: number, previous: number): boolean => level > previous + 4;
                createReaction({ watch: bindings.level, when: isBigRise, react: () => {} });
                // Any key order infers the same
                createReaction({
                    react: (current) => expectTypeOf(current).toEqualTypeOf<GamePhase>(),
                    when: 'dying',
                    watch: bindings.phase,
                });
                // A computed primitive is a getter, and a computed object is watched by its version
                createReaction({ watch: scoreText, react: (text) => expectTypeOf(text).toEqualTypeOf<string>() });
                createReaction({ watch: () => cells.version, when: increased, react: () => {} });
                const reaction = createReaction({ watch: bindings.phase, react: () => {} });
                expectTypeOf(reaction).toEqualTypeOf<() => void>();

                // A fixed array
                createReaction({
                    watch: model.reels.map((reel) => () => reel.phase),
                    when: 'settling',
                    react: (current, _previous, index) => {
                        expectTypeOf(current).toEqualTypeOf<ReelPhase>();
                        expectTypeOf(index).toEqualTypeOf<number>();
                    },
                });
                createReaction({
                    watch: [bindings.spins, bindings.level],
                    when: (_current, _previous, index) => index > 0,
                    react: () => {},
                });
                createReaction({
                    watch: [scoreText, bindings.label],
                    react: (text) => expectTypeOf(text).toEqualTypeOf<string>(),
                });
                // Arrays held in variables, whose getters return the same type
                const counts = [bindings.spins, bindings.level];
                createReaction({ watch: counts, when: increased, react: () => {} });
                const either = model.reels.map((reel) => (): GamePhase | ReelPhase => reel.phase);
                createReaction({ watch: either, react: () => {} });
                const declared: readonly (() => GamePhase | ReelPhase)[] = [bindings.phase, reelPhase];
                createReaction({ watch: declared, when: 'settling', react: () => {} });

                // Mistakes
                // @ts-expect-error: 'bounce' isn't a GamePhase.
                createReaction({ watch: bindings.phase, when: 'bounce', react: () => {} });
                // @ts-expect-error: `increased` needs a number or a bigint.
                createReaction({ watch: bindings.phase, when: increased, react: () => {} });
                // @ts-expect-error: a record is for createComputed and watch.
                createReaction({ watch: { cols: bindings.cols, rows: bindings.rows }, react: () => {} });
                // @ts-expect-error: an array isn't watchable.
                createReaction({ watch: () => model.reels, react: () => {} });
                // @ts-expect-error: a computed object isn't a getter of a primitive: watch its version.
                createReaction({ watch: cells, react: () => {} });
                // @ts-expect-error: `react` is required.
                createReaction({ watch: bindings.phase, when: 'dying' });
                // @ts-expect-error: one getter's `react` has no index.
                createReaction({ watch: bindings.phase, react: (_current, _previous, _index: number) => {} });
                // @ts-expect-error: an empty array never reacts.
                createReaction({ watch: [], react: () => {} });
                // @ts-expect-error: the getters share `when`, so they must return the same type.
                createReaction({ watch: [bindings.phase, bindings.spins], react: () => {} });
                // @ts-expect-error: two different string unions are mixed types too.
                createReaction({ watch: [bindings.phase, reelPhase], react: () => {} });
                const mixedPhases = [bindings.phase, reelPhase];
                // @ts-expect-error: a mixed array held in a variable is refused too.
                createReaction({ watch: mixedPhases, react: () => {} });
                const mixedKinds = [bindings.label, bindings.spins];
                // @ts-expect-error: and so is a string with a number.
                createReaction({ watch: mixedKinds, react: () => {} });
            };
            /* eslint-enable @mvtjs/no-unused-watch */
            expect(declareTests).toBeTypeOf('function');
        });
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type GamePhase = 'playing' | 'dying' | 'respawning' | 'game-over';
type ReelPhase = 'stopped' | 'spinning' | 'settling';

interface Fixtures {
    readonly bindings: {
        readonly phase: () => GamePhase;
        readonly spins: () => number;
        readonly level: () => number;
        readonly total: () => bigint;
        readonly label: () => string;
        readonly cols: () => number;
        readonly rows: () => number;
    };
    readonly model: { readonly reels: readonly { readonly phase: ReelPhase }[] };
    readonly scoreText: Computed<string>;
    readonly cells: Computed<number[]>;
    readonly reelPhase: () => ReelPhase;
}
