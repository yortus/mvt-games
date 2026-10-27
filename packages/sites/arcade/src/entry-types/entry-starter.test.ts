import { Container } from 'pixi.js';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createHeadlessAudio80, createHeadlessAudio90 } from 'audio90/headless';
import type { MusicChip, SfxChip } from '#shared';
import {
    defineElementLoader, definePixiLoader, type ElementEntrySession, type ElementEntryStarter, type PixiEntryStarter,
    type PixiStartOptions, type SessionChips, type SoundChipFinder, startPixiEntry,
} from './entry-starter';

// The type checks here run as the repo's types are checked. Each
// `@ts-expect-error` line must fail to compile, or the check fails. The
// loaders are made as an entry makes its own, with no type written: the chip
// is worked out from the starter's `soundChip`.

describe('a starter\'s sound chips', () => {
    it('gives a starter that names a kind of chip a music chip and a sound effects chip of that kind', async () => {
        const chips = createChips('audio80');
        let given: object[] = [];
        const load = definePixiLoader(async () => ({
            ...PIXI_FIELDS,
            soundChip: 'audio80',
            start: ({ music, sfx }) => {
                expectTypeOf(music).toEqualTypeOf<MusicChip<'audio80'>>();
                expectTypeOf(sfx).toEqualTypeOf<SfxChip<'audio80'>>();
                given = [music, sfx];
                return SESSION;
            },
        }));
        expectTypeOf(load).returns.resolves.toEqualTypeOf<PixiEntryStarter<'audio80'>>();
        startPixiEntry(await load(), { stage: new Container() }, findIn('audio80', chips));
        expect(given).toEqual([chips.music, chips.sfx]);
    });

    it('gives a starter that names the Audio90 Audio90s, which only play, and only the music chip their songs', async () => {
        const chips = createChips('audio90');
        let given: object | undefined;
        const load = definePixiLoader(async () => ({
            ...PIXI_FIELDS,
            soundChip: 'audio90',
            start: ({ music }) => {
                given = music;
                return SESSION;
            },
        }));
        // Never called: it is here to be type checked
        const misuse = (options: PixiStartOptions<'audio90'>): void => {
            // @ts-expect-error The host pauses the chips, not the entry
            options.music.pause();
            // @ts-expect-error The sound effects chip reports no song
            void options.sfx.song;
        };
        startPixiEntry(await load(), { stage: new Container() }, findIn('audio90', chips));
        expect(given).toBe(chips.music);
        expect(misuse).toBeTypeOf('function');
    });

    it('gives a starter that names no chip none, and its options have no music or sound effects', async () => {
        // Never called: it is here to be type checked
        const playOnNoChip = (given: PixiStartOptions<undefined>): void => {
            // @ts-expect-error A session that makes no sound has no chip to play on
            given.sfx.play();
        };
        let options: object | undefined;
        const load = definePixiLoader(async () => ({
            ...PIXI_FIELDS,
            start: (given) => {
                expectTypeOf(given.music).toEqualTypeOf<undefined>();
                expectTypeOf(given.sfx).toEqualTypeOf<undefined>();
                options = given;
                return SESSION;
            },
        }));
        expectTypeOf(load).returns.resolves.toEqualTypeOf<PixiEntryStarter<undefined>>();
        startPixiEntry(await load(), { stage: new Container() }, refuseChip);
        expect(options).not.toHaveProperty('music');
        expect(options).not.toHaveProperty('sfx');
        expect(playOnNoChip).toBeTypeOf('function');
    });

    it('works out an element entry\'s chips the same way', async () => {
        const load = defineElementLoader(async () => ({
            kind: 'element',
            soundChip: 'audio90',
            start: ({ music }) => {
                expectTypeOf(music).toEqualTypeOf<MusicChip<'audio90'>>();
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

/** Headless chips of `kind`, one for music and one for sound effects. */
function createChips<K extends 'audio80' | 'audio90'>(kind: K): SessionChips<K> {
    const create = () => (kind === 'audio80' ? createHeadlessAudio80() : createHeadlessAudio90());
    // `kind` says which chips these are, which TypeScript can't follow into their type
    return { music: create(), sfx: create() } as unknown as SessionChips<K>;
}

/** A chip finder that finds `chips` for `kind`, and refuses any other kind. */
function findIn<M extends 'audio80' | 'audio90'>(made: M, chips: SessionChips<M>): SoundChipFinder {
    return <K extends 'audio80' | 'audio90'>(kind: K) => {
        if ((kind as string) !== made) throw new Error(`asked for the ${kind}, not the ${made}`);
        return chips as unknown as SessionChips<K>;
    };
}

/** A chip finder for a session that must not ask for one. */
function refuseChip(): never {
    throw new Error('asked for a chip');
}
