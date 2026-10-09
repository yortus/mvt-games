import { describe, expect, it, vi } from 'vitest';
import { type Container, Sprite, Texture } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { ALL_CACTUS_KINDS, type CactusKind, createGameModel } from '../models';
import { GameView } from './game-view';

// A texture per kind, so the sprites say which kind each cell shows
const TEXTURES = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../data', async (importOriginal) => ({
    ...await importOriginal<typeof import('../data')>(),
    textures: { load: async () => {}, get: () => ({ cactus: Object.fromEntries(TEXTURES) }) },
}));
for (const kind of ALL_CACTUS_KINDS) TEXTURES.set(kind, new Texture({ label: kind }));

describe('GameView', () => {
    it('shows the new board after a restart, not the old one', () => {
        const game = createGameModel();
        const view = GameView({ model: game, sound: createHeadlessAudio80().audio80 });
        tick(view);
        const oldKinds = listBoardKinds(game.board.cells);
        expect(listShownKinds(view)).toEqual(oldKinds);

        game.reset();
        // The boards are random: check this one differs, so the test can tell them apart
        expect(listBoardKinds(game.board.cells)).not.toEqual(oldKinds);
        tick(view);
        expect(listShownKinds(view)).toEqual(listBoardKinds(game.board.cells));
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tick(view: Container): void {
    updateView(view, 1000 / 60);
    refreshView(view);
}

/** The kinds the cactus sprites show, in the order they were made: row by row. */
function listShownKinds(view: Container): CactusKind[] {
    const kinds: CactusKind[] = [];
    walk(view);
    return kinds;

    function walk(node: Container): void {
        if (node instanceof Sprite && ALL_CACTUS_KINDS.includes(node.texture.label as CactusKind)) {
            kinds.push(node.texture.label as CactusKind);
        }
        for (const child of node.children) walk(child);
    }
}

function listBoardKinds(cells: readonly (readonly { readonly kind: CactusKind }[])[]): CactusKind[] {
    return cells.flatMap((row) => row.map((cell) => cell.kind));
}
