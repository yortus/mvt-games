// Spike: every Pixi entry's whole screen, started and advanced as the thumbnail page does.
import { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { beforeEach, describe } from 'vitest';
import { CATALOGUE } from '../src/entries';
import type { EntrySession, PixiEntryStarter } from '../src/entry-types';
import { visualTest } from './harness';

const STEP_MS = 16;
const PIXI_ENTRIES = ['neon-monsoon', 'crumb-chase', 'falling-sand', 'galaxy-raiders', 'burrow-bust', 'dojo-duel', 'boids', 'kwazy-cactii', 'reordering-lists', 'fuel-run', 'astrovoid'];

let session: EntrySession | undefined;
beforeEach(() => {
    session?.destroy();
    session = undefined;
});

/** Whether each entry is pixel art, known only once loaded: the options are fixed when the test is declared. */
const PIXEL_ART: Record<string, boolean> = {
    'crumb-chase': true, 'galaxy-raiders': true, 'burrow-bust': true, 'dojo-duel': true, 'kwazy-cactii': true, 'fuel-run': true, 'astrovoid': true, 'neon-monsoon': true,
};

export function entryPose(id: string, advanceMs: number | 'thumbnail'): () => Promise<Container> {
    return async () => {
        const entry = CATALOGUE.find((e) => e.id === id)!;
        const starter = await entry.load() as PixiEntryStarter;
        starter.fitTo?.(entry.screenWidth, entry.screenHeight);
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

describe('entries', () => {
    for (const id of PIXI_ENTRIES) {
        visualTest(`${id} thumbnail`, entryPose(id, 'thumbnail'), entrySize(id));
        visualTest(`${id} 2s`, entryPose(id, 2000), entrySize(id));
    }
});
