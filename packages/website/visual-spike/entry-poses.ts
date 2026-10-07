// Spike: starting a Pixi entry headless and advancing it, as the thumbnail page does.
import { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { CATALOGUE } from '../src/entries';
import type { EntrySession, PixiEntryStarter } from '../src/entry-types';

const STEP_MS = 16;
export const PIXI_ENTRIES = ['neon-monsoon', 'crumb-chase', 'falling-sand', 'galaxy-raiders', 'burrow-bust', 'dojo-duel', 'boids', 'kwazy-cactii', 'reordering-lists', 'fuel-run', 'astrovoid'];

// The last entry started; a module-level hook would register in the first file only, as every file shares this module
let session: EntrySession | undefined;

/** Whether each entry is pixel art, known only once loaded: the options are fixed when the test is declared. */
const PIXEL_ART: Record<string, boolean> = {
    'crumb-chase': true, 'galaxy-raiders': true, 'burrow-bust': true, 'dojo-duel': true, 'kwazy-cactii': true, 'fuel-run': true, 'astrovoid': true, 'neon-monsoon': true,
};

export function entryPose(id: string, advanceMs: number | 'thumbnail'): () => Promise<Container> {
    return async () => {
        const entry = CATALOGUE.find((e) => e.id === id)!;
        const starter = await entry.load() as PixiEntryStarter;
        starter.fitTo?.(entry.screenWidth, entry.screenHeight);
        session?.destroy();
        session = undefined;
        const stage = new Container();
        session = starter.start({ stage });
        const totalMs = advanceMs === 'thumbnail' ? (starter.thumbnailAdvanceMs ?? STEP_MS) : advanceMs;
        let remaining = totalMs;
        while (remaining > 0) {
            const step = Math.min(STEP_MS, remaining);
            if (advanceMs === 'thumbnail') starter.thumbnailInput?.(session, totalMs - remaining);
            session.update(step);
            updateView(stage, step);
            remaining -= step;
        }
        refreshView(stage);
        return stage;
    };
}

export function entrySize(id: string): { width: number; height: number; pixelArt: boolean } {
    const entry = CATALOGUE.find((e) => e.id === id)!;
    return { width: entry.screenWidth, height: entry.screenHeight, pixelArt: PIXEL_ART[id] ?? false };
}

