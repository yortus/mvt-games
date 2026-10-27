import { Container, Texture } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { startPixiEntry } from '../entry-types';
import { createHeadlessSound } from '../runner';
import { CATALOGUE } from './catalogue';

// Loading a spritesheet needs a browser. Every texture becomes Pixi's 1x1
// white one, as in the benchmarks: models never read textures, and nothing
// here is drawn.
vi.mock('@mvtjs/pixi', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    type NameMap = { readonly [key: string]: string | NameMap };
    const whiteFor = (map: NameMap): Record<string, unknown> => {
        const record: Record<string, unknown> = {};
        for (const key in map) {
            const value = map[key];
            record[key] = typeof value === 'string' ? Texture.WHITE : whiteFor(value);
        }
        return record;
    };
    return {
        ...actual,
        createTextureRegistry: (_url: string, nameMap: NameMap) => {
            const record = whiteFor(nameMap);
            return { load: async () => {}, get: () => record };
        },
    };
});

/** Long enough for any game to have started its run. */
const SETTLE_MS = 1000;
const FRAME_MS = 1000 / 60;

describe('each game with a highscore table', () => {
    for (const entry of CATALOGUE.filter((e) => e.hasHighscores === true)) {
        it(`${entry.id} reports its score, and a run not yet over`, async () => {
            const starter = await entry.load();
            if (starter.kind !== 'pixi') throw new Error(`${entry.id}: only Pixi games are checked here`);
            const session = startPixiEntry(starter, { stage: new Container() }, createHeadlessSound(starter).findChips);
            try {
                expect(session.scoring).toBeDefined();
                for (let elapsed = 0; elapsed < SETTLE_MS; elapsed += FRAME_MS) session.update(FRAME_MS);
                expect(Number.isSafeInteger(session.scoring?.score())).toBe(true);
                expect(session.scoring?.isOver()).toBe(false);
            }
            finally {
                session.destroy();
            }
        });
    }
});
