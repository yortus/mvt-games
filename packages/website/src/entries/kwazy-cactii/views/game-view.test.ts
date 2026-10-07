import { describe, expect, it, vi } from 'vitest';
import { type Container, Sprite, Texture } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
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
        const view = GameView({ model: game });
        tick(view);
        const oldKinds = boardKinds(game.board.cells);
        expect(shownKinds(view)).toEqual(oldKinds);

        game.reset();
        // The boards are random: check this one differs, so the test can tell them apart
        expect(boardKinds(game.board.cells)).not.toEqual(oldKinds);
        tick(view);
        expect(shownKinds(view)).toEqual(boardKinds(game.board.cells));
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
function shownKinds(view: Container): CactusKind[] {
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

function boardKinds(cells: readonly (readonly { readonly kind: CactusKind }[])[]): CactusKind[] {
    return cells.flatMap((row) => row.map((cell) => cell.kind));
}
