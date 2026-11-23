import { LEAN_MS, TURN_MS } from '../data';
import { createMarginGameModel, type MarginGameModel } from './margin-game-model';
import { createPaperLayout, type PaperLayout } from './paper-layout';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What the reader is doing. They read a spread, turn a page to the next or
 * the last, lean in to the puzzle on the spread, play it, and lean back to
 * read again. Turning a page and leaning in or back each take a moment.
 */
export type PaperMode = 'reading' | 'turning' | 'leaning-in' | 'playing' | 'leaning-back';

/** Which way a page turns: forward, to the next spread, or back, to the last. */
export type TurnDirection = 'forward' | 'back';

/**
 * A day's paper, lying on a desk, and the reader reading it. The paper is
 * the front page, a spread for each puzzle, and the back page. The reader
 * turns its pages one at a time. On a spread with a puzzle, they can lean in
 * to the puzzle's box until it fills their view, and play it.
 *
 * In the margin of the back page, someone has pencilled a grid for noughts
 * and crosses, and whoever it was is still at the table. The paper never
 * points it out. A reader who finds it can play, while the back page lies
 * open.
 */
export interface GameModel {
    readonly layout: PaperLayout;
    /** How many spreads the paper has, the front page and the back page among them. */
    readonly spreadCount: number;
    /** The spread open, or, while a page turns, the spread it turns from. */
    readonly spread: number;
    readonly mode: PaperMode;
    /** Which way the page turning goes, or the last one went. */
    readonly turnDirection: TurnDirection;
    /** How far the page turning has turned, from 0 to 1. It's 0 while no page turns. */
    readonly turnProgress: number;
    /** How many pages the reader has turned, a count that rises with each turn. */
    readonly pagesTurned: number;
    /** The puzzle on the spread open, by its index in the paper's list of puzzles, if it has one. */
    readonly puzzleOnSpread: number | undefined;
    /** Whether the reader could turn forward, or back, now. */
    readonly canTurnForward: boolean;
    readonly canTurnBack: boolean;
    /** The puzzle the reader leans in to, plays and leans back from, until they read again. */
    readonly puzzleInPlay: number | undefined;
    /**
     * How far the reader has leant in to the puzzle in play, from 0 to 1.
     * It's 0 while reading, rises as they lean in, is 1 while they play, and
     * falls as they lean back.
     */
    readonly lean: number;
    /** The game of noughts and crosses in the back page's margin. */
    readonly marginGame: MarginGameModel;
    /** Whether the back page lies open, so the reader can play the margin game. */
    readonly isMarginGameOpen: boolean;
    /** Pencils the reader's cross in square `cell` of the margin game, while it's open. */
    readonly markMarginCell: (cell: number) => void;
    /** Turns the page to the next spread, while reading. */
    readonly turnForward: () => void;
    /** Turns the page back to the last spread, while reading. */
    readonly turnBack: () => void;
    /** Leans in to the puzzle on the spread, to play it once the reader has leant in. */
    readonly playPuzzle: () => void;
    /** Leans back from the puzzle leant in to, or played, and reads again once the reader has leant back. */
    readonly stopPlaying: () => void;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    /** The day of the paper, as a day number. */
    readonly day: number;
    /** Each puzzle's play area, width over height, by its index in the paper's list. */
    readonly puzzleAspects: readonly number[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the day's paper, lying closed, with its front page up. */
export function createGameModel({ day, puzzleAspects }: GameModelOptions): GameModel {
    const layout = createPaperLayout({ day, puzzleAspects });
    const spreadCount = layout.spreads.length;
    let spread = 0;
    let mode: PaperMode = 'reading';
    let turnDirection: TurnDirection = 'forward';
    let pagesTurned = 0;
    let puzzleInPlay: number | undefined;
    /** How long the turn, or the lean in or back, has lasted. */
    let elapsedMs = 0;
    // The day's paper has the day's game, so its other player plays the same way all day
    const marginGame = createMarginGameModel({ seed: day });

    const model: GameModel = {
        layout,
        spreadCount,
        get spread() {
            return spread;
        },
        get mode() {
            return mode;
        },
        get turnDirection() {
            return turnDirection;
        },
        get turnProgress() {
            return mode === 'turning' ? elapsedMs / TURN_MS : 0;
        },
        get pagesTurned() {
            return pagesTurned;
        },
        get puzzleOnSpread() {
            return layout.spreads[spread].puzzleIndex;
        },
        get canTurnForward() {
            return mode === 'reading' && spread < spreadCount - 1;
        },
        get canTurnBack() {
            return mode === 'reading' && spread > 0;
        },
        get puzzleInPlay() {
            return puzzleInPlay;
        },
        get lean() {
            switch (mode) {
                case 'reading':
                case 'turning':
                    return 0;
                case 'leaning-in':
                    return elapsedMs / LEAN_MS;
                case 'playing':
                    return 1;
                case 'leaning-back':
                    return 1 - elapsedMs / LEAN_MS;
            }
        },

        marginGame,
        get isMarginGameOpen() {
            return mode === 'reading' && spread === spreadCount - 1;
        },
        markMarginCell(cell) {
            if (model.isMarginGameOpen) marginGame.markCell(cell);
        },

        turnForward() {
            if (model.canTurnForward) startTurn('forward');
        },

        turnBack() {
            if (model.canTurnBack) startTurn('back');
        },

        playPuzzle() {
            const puzzle = model.puzzleOnSpread;
            if (mode !== 'reading' || puzzle === undefined) return;
            mode = 'leaning-in';
            elapsedMs = 0;
            puzzleInPlay = puzzle;
        },

        stopPlaying() {
            if (mode !== 'leaning-in' && mode !== 'playing') return;
            // Leaning back part way in takes as long as the part leant
            elapsedMs = mode === 'leaning-in' ? LEAN_MS - elapsedMs : 0;
            mode = 'leaning-back';
        },

        update(deltaMs) {
            // The other player thinks, and a finished game is rubbed out, only while the reader can see the margin
            if (model.isMarginGameOpen) marginGame.update(deltaMs);
            switch (mode) {
                case 'turning':
                    elapsedMs = Math.min(TURN_MS, elapsedMs + deltaMs);
                    if (elapsedMs < TURN_MS) return;
                    spread += turnDirection === 'forward' ? 1 : -1;
                    mode = 'reading';
                    elapsedMs = 0;
                    return;
                case 'leaning-in':
                    elapsedMs = Math.min(LEAN_MS, elapsedMs + deltaMs);
                    if (elapsedMs === LEAN_MS) mode = 'playing';
                    return;
                case 'leaning-back':
                    elapsedMs = Math.min(LEAN_MS, elapsedMs + deltaMs);
                    if (elapsedMs < LEAN_MS) return;
                    mode = 'reading';
                    elapsedMs = 0;
                    puzzleInPlay = undefined;
                    return;
                case 'reading':
                case 'playing':
                    return;
            }
        },
    };
    return model;

    function startTurn(direction: TurnDirection): void {
        mode = 'turning';
        turnDirection = direction;
        elapsedMs = 0;
        pagesTurned++;
    }
}
