import { Container, type FederatedPointerEvent, Graphics } from 'pixi.js';
import { advanceTime, refreshView } from '@mvtjs/pixi';
import { createMemoryStore } from '@mvtjs/site-kit/storage';
import { PAPER_COLOR, toDayNumber } from '../../../../shared';
import { createGameModel, type GameModel, playShowcase } from '../../models';
import { layOutPicture } from '../picture-layout';
import { BOARD_HEIGHT, BOARD_WIDTH, SCREEN_HEIGHT, SCREEN_WIDTH } from '../view-constants';

/** Today, in every pose: Saturday 7 November 2026. */
export const TODAY = toDayNumber({ year: 2026, month: 11, day: 7 });

/** Something done in a game, or on its view, to bring it into the state a pose shows. */
export type Play = (model: GameModel, view: Container) => void;

/**
 * Returns the view `makeView` makes of a new game on `TODAY`, on paper,
 * after `play` has played in it and `ms` has passed. A list of plays has a
 * frame pass after each, refreshed as on screen, so the view sees each of
 * them.
 */
export async function poseGame(makeView: (model: GameModel) => Container, play: Play | readonly Play[], ms = 16): Promise<Container> {
    const model = createGameModel({ today: TODAY, store: createMemoryStore(), offersIntro: false });
    const view = new Container();
    view.addChild(new Graphics().rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(PAPER_COLOR), makeView(model));
    await advanceTime(16, model, view);
    const plays = typeof play === 'function' ? [play] : play;
    for (let i = 0; i < plays.length; i++) {
        if (i > 0) {
            await advanceTime(16, model, view);
            refreshView(view);
        }
        plays[i](model, view);
    }
    await advanceTime(ms, model, view);
    return view;
}

/** Takes every piece of the open puzzle home, in the fewest swaps. */
export function solve(model: GameModel): void {
    const puzzle = model.puzzle!;
    const count = puzzle.puzzle.patch.count;
    for (let tile = 0; tile < count; tile++) {
        if (puzzle.pieceAt(tile) === tile) continue;
        for (let other = 0; other < count; other++) {
            if (puzzle.pieceAt(other) !== tile) continue;
            puzzle.swap(tile, other);
            break;
        }
    }
}

/** Takes one piece of the open puzzle home, nearest the middle first, with one swap, which sends two pieces flying. */
export function swapOneHome(model: GameModel): void {
    const puzzle = model.puzzle!;
    for (let tile = 0; tile < puzzle.puzzle.patch.count; tile++) {
        const piece = puzzle.pieceAt(tile);
        if (piece === tile) continue;
        puzzle.swap(tile, piece);
        return;
    }
}

/** Takes home a piece that belongs next to a locked one, nearest the middle first, so it locks as it lands. */
export function lockOneMore(model: GameModel): void {
    const puzzle = model.puzzle!;
    const { patch, locked } = puzzle.puzzle;
    for (let tile = 0; tile < patch.count; tile++) {
        if (puzzle.pieceAt(tile) === tile || !patch.neighboursOf(tile).some((t) => locked[t] === 1)) continue;
        puzzle.swap(tile, findTileOf(puzzle, tile));
        return;
    }
}

/** Takes home the piece of the free tile nearest the middle that the frame trims, so the piece on it flies out. */
export function swapTrimmedHome(model: GameModel): void {
    const puzzle = model.puzzle!;
    const { patch, locked } = puzzle.puzzle;
    for (let tile = 0; tile < patch.count; tile++) {
        if (patch.trims[tile] === 0 || locked[tile] === 1) continue;
        puzzle.swap(tile, findTileOf(puzzle, tile));
        return;
    }
    throw new Error('The open window has no free piece trimmed by the frame');
}

/**
 * Picks up the free piece nearest the middle that the frame trims, from the
 * board in `view`, and drags it a little way in towards the middle, holding
 * it there.
 */
export function dragTrimmedPiece(model: GameModel, view: Container): void {
    const { patch, locked } = model.puzzle!.puzzle;
    let tile = 0;
    while (tile < patch.count && (patch.trims[tile] === 0 || locked[tile] === 1)) tile++;
    if (tile === patch.count) throw new Error('The open window has no free piece trimmed by the frame');
    const board = findLabelled(view, 'board');
    const { centreX, centreY, scale } = layOutPicture({ halfWidth: patch.halfWidth, halfHeight: patch.halfHeight, width: BOARD_WIDTH, height: BOARD_HEIGHT });
    const x = centreX + patch.middleXs[tile] * scale;
    const y = centreY + patch.middleYs[tile] * scale;
    // A third of the way to the middle
    board.emit('pointerdown', pointerAt(x, y));
    board.emit('globalpointermove', pointerAt(x + (centreX - x) / 3, y + (centreY - y) / 3));
}

/** The first container in `view`, or under it, labelled `label`. */
function findLabelled(view: Container, label: string): Container {
    if (view.label === label) return view;
    for (const child of view.children) {
        const found = findLabelled(child, label);
        if (found.label === label) return found;
    }
    return view;
}

/** A mouse's pointer event, at (x, y) in the pixels of the container it is sent to. */
function pointerAt(x: number, y: number): FederatedPointerEvent {
    return { pointerId: 1, isPrimary: true, pointerType: 'mouse', getLocalPosition: () => ({ x, y }) } as unknown as FederatedPointerEvent;
}

/** The tile the piece `piece` is on. */
function findTileOf(puzzle: NonNullable<GameModel['puzzle']>, piece: number): number {
    for (let t = 0; t < puzzle.puzzle.patch.count; t++) if (puzzle.pieceAt(t) === piece) return t;
    return -1;
}

/** Plays some of today's medium puzzle, as the thumbnail shows it. */
export function playSome(model: GameModel): void {
    playShowcase(model);
}
