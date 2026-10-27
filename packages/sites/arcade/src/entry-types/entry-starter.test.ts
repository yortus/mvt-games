import { Container } from 'pixi.js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Audio80, Audio90 } from 'audio90';
import { createHeadlessAudio80, createHeadlessAudio90 } from 'audio90/headless';
import {
    defineElementLoader, definePixiLoader, type ElementEntrySession, type ElementEntryStarter, type PixiEntryStarter,
    type PixiStartOptions, type SoundChipFinder, type SoundChipsByKind, startPixiEntry,
} from './entry-starter';

// The type checks here run as the repo's types are checked. Each
// `@ts-expect-error` line must fail to compile, or the check fails. The
// loaders are made as an entry makes its own, with no type written: the chip
// is worked out from the starter's `soundChip`.

describe('a starter\'s sound chip', () => {
    it('gives a starter that names a chip that chip, typed as its kind', async () => {
        const audio80 = createHeadlessAudio80();
        let given: Audio80 | undefined;
        const load = definePixiLoader(async () => ({
            ...PIXI_FIELDS,
            soundChip: 'audio80',
            start: ({ sound }) => {
                expectTypeOf(sound).toEqualTypeOf<Audio80>();
                given = sound;
                return SESSION;
            },
        }));
        expectTypeOf(load).returns.resolves.toEqualTypeOf<PixiEntryStarter<'audio80'>>();
        startPixiEntry(await load(), { stage: new Container() }, findIn(createChips({ audio80 })));
        expect(given).toBe(audio80);
    });

    it('gives a starter that names the Audio90 an Audio90, not the Audio80', async () => {
        const audio90 = createHeadlessAudio90();
        let given: Audio90 | undefined;
        const load = definePixiLoader(async () => ({
            ...PIXI_FIELDS,
            soundChip: 'audio90',
            start: ({ sound }) => {
                given = sound;
                return SESSION;
            },
        }));
        // Never called: it is here to be type checked
        const filterOnAudio90 = (options: PixiStartOptions<'audio90'>): void => {
            // @ts-expect-error The Audio90 has no Audio80 filters
            options.sound.setFilter('a', 'cutoffHz', 500);
        };
        startPixiEntry(await load(), { stage: new Container() }, findIn(createChips({ audio90 })));
        expect(given).toBe(audio90);
        expect(filterOnAudio90).toBeTypeOf('function');
    });

    it('gives a starter that names no chip none, and its options have no sound', async () => {
        // Never called: it is here to be type checked
        const playOnNoChip = (given: PixiStartOptions<undefined>): void => {
            // @ts-expect-error A session that makes no sound has no chip to play on
            given.sound.releaseAll();
        };
        let options: object | undefined;
        const load = definePixiLoader(async () => ({
            ...PIXI_FIELDS,
            start: (given) => {
                expectTypeOf(given.sound).toEqualTypeOf<undefined>();
                options = given;
                return SESSION;
            },
        }));
        expectTypeOf(load).returns.resolves.toEqualTypeOf<PixiEntryStarter<undefined>>();
        startPixiEntry(await load(), { stage: new Container() }, refuseChip);
        expect(options).not.toHaveProperty('sound');
        expect(playOnNoChip).toBeTypeOf('function');
    });

    it('works out an element entry\'s chip the same way', async () => {
        const load = defineElementLoader(async () => ({
            kind: 'element',
            soundChip: 'audio90',
            start: ({ sound }) => {
                expectTypeOf(sound).toEqualTypeOf<Audio90>();
                return ELEMENT_SESSION;
            },
        }));
        expectTypeOf(load).returns.resolves.toEqualTypeOf<ElementEntryStarter<'audio90'>>();
        expect((await load()).soundChip).toBe('audio90');
    });

    it('refuses a chip that does not exist, and a starter used for another chip', () => {
        // @ts-expect-error There is no Audio70
        const unknown = definePixiLoader(async () => ({ ...PIXI_FIELDS, soundChip: 'audio70', start: () => SESSION }));
        // @ts-expect-error A loader for the Audio80 is not one for the Audio90
        const wrong: () => Promise<PixiEntryStarter<'audio90'>> = definePixiLoader(async () => ({ ...PIXI_FIELDS, soundChip: 'audio80', start: () => SESSION }));
        // @ts-expect-error A starter typed for the Audio80 must say so in `soundChip`
        const unnamed: PixiEntryStarter<'audio80'> = { ...PIXI_FIELDS, start: () => SESSION };
        expect([unknown, wrong, unnamed]).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PIXI_FIELDS = { kind: 'pixi', screenWidth: 100, screenHeight: 100 } as const;
const SESSION = { update: () => {}, destroy: () => {} };
const ELEMENT_SESSION: ElementEntrySession = { ...SESSION, views: [], render: () => {} };

/** A chip of each kind: those given, and a headless chip for the rest. */
function createChips(given: Partial<SoundChipsByKind>): SoundChipsByKind {
    return { audio80: given.audio80 ?? createHeadlessAudio80(), audio90: given.audio90 ?? createHeadlessAudio90() };
}

/** A chip finder that finds each kind's chip in `chips`. */
function findIn(chips: SoundChipsByKind): SoundChipFinder {
    return (kind) => chips[kind];
}

/** A chip finder for a session that must not ask for one. */
function refuseChip(): never {
    throw new Error('asked for a chip');
}
