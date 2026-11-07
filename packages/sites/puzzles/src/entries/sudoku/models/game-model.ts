import type { LocalStore } from '@mvtjs/site-kit/storage';
import {
    createDailyCalendar, createDailyRecords, createIntroModel, type DailyCalendar, type IntroModel, PUZZLE_LEVELS, type PuzzleLevel,
} from '../../../shared';
import type { GeneratedSudoku, SudokuGenerator } from '../generator';
import { findPuzzleSeed } from './find-puzzle-seed';
import {
    EXAMPLE_LEVEL, EXAMPLE_SEED, FIRST_DAY, FORMER_LEVEL_NAMES, GENERATOR_LEVELS, PRACTICE_LEVEL, PRACTICE_SEED, STARTING_LEVEL,
} from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { SUDOKU_WALKTHROUGH, type SudokuPractice, type SudokuTarget } from './sudoku-walkthrough';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What is on screen: the calendar of days to choose from, or a puzzle being played. */
export type SudokuPhase = 'calendar' | 'playing';

/**
 * A puzzle for each day, at each of four levels. Every player gets the same
 * puzzles on the same day, as each is made from a seed worked out from its
 * date and its level. Each puzzle's progress, and which are solved, are
 * kept between visits.
 *
 * The way in is the one every puzzle on the site has: a card that says how
 * to play, as a player first opens the game, and a walkthrough of
 * making notes, on a practice puzzle, which stands in for the puzzle open
 * until it ends, and is never kept.
 */
export interface GameModel {
    /** What is on screen. It is `playing` while a walkthrough plays, wherever it was started from. */
    readonly phase: SudokuPhase;
    /** The calendar of days to choose from, at each level. */
    readonly calendar: DailyCalendar<PuzzleLevel>;
    /** The puzzle being played, while one is: the practice puzzle while the walkthrough plays. */
    readonly puzzle: PuzzleModel | undefined;
    /** The way in: the card that says how to play, and the walkthrough. */
    readonly intro: IntroModel<SudokuPractice, SudokuTarget>;
    /** The puzzle the card shows, filled in. */
    readonly example: GeneratedSudoku;
    /** The day and level of the puzzle being played, or the last one played. */
    readonly puzzleDay: number;
    readonly puzzleLevel: PuzzleLevel;
    /** Puzzles opened, and solved, on this visit. The practice puzzle counts as opened, as the walkthrough starts and ends. */
    readonly puzzlesOpened: number;
    readonly puzzlesSolved: number;
    /** Whether there is a puzzle to start again: one of the calendar's, open, and not the walkthrough's practice puzzle. */
    readonly canRestartPuzzle: boolean;

    /** Opens `day`'s puzzle at the calendar's level, as it was left, if the day has one. */
    openPuzzle: (day: number) => void;
    /** Puts the way in away, keeps the puzzle's progress, and goes back to the calendar. */
    closePuzzle: () => void;
    /**
     * Starts the open puzzle again, with nothing in it, and forgets its
     * progress, so it no longer counts as started until the next move. Its
     * undo history goes too. A puzzle solved already stays ticked off on the
     * calendar. Does nothing unless `canRestartPuzzle`.
     */
    restartPuzzle: () => void;
    /** Keeps the puzzle's progress now, if it changed since it was last kept, and ticks it off once it is solved. */
    keepProgress: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GameModelOptions {
    /** Today's date where the player is, numbered from 1 January 1970. The page reads the clock, and the model takes the day it gives. */
    readonly today: number;
    /** Where the progress and the solved puzzles are kept. */
    readonly store: LocalStore;
    /** Whether the card that says how to play shows by itself as a player first opens the game. Tests and the thumbnail leave it out. */
    readonly offersIntro: boolean;
    /** Makes a puzzle from a seed, at a level: Sudoku Digger's puzzle maker. */
    readonly generate: SudokuGenerator;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the game on the calendar, at this month, at the level chosen last. */
export function createGameModel(options: GameModelOptions): GameModel {
    const { today, generate } = options;
    const records = createDailyRecords({ store: options.store, gameId: 'sudoku', levels: PUZZLE_LEVELS, formerLevelNames: FORMER_LEVEL_NAMES });
    const calendar = createDailyCalendar({ today, firstDay: FIRST_DAY, levels: PUZZLE_LEVELS, startingLevel: STARTING_LEVEL, records });
    const intro = createIntroModel({ records, createPractice, ...SUDOKU_WALKTHROUGH });
    const example = generate({ seed: EXAMPLE_SEED, level: EXAMPLE_LEVEL });

    let phase: SudokuPhase = 'calendar';
    // The level of the puzzle being played, or the last one played
    let level = calendar.level;
    let puzzle: PuzzleModel | undefined;
    // The open puzzle's givens and solution, for starting it again
    let opened: GeneratedSudoku | undefined;
    let puzzleDay = today;
    let keptChanges = 0;
    let puzzlesOpened = 0;
    let puzzlesSolved = 0;

    const model: GameModel = {
        // A walkthrough plays on the puzzle's screen, even one started from the calendar
        get phase() { return intro.practice === undefined ? phase : 'playing'; },
        calendar,
        get puzzle() { return intro.practice?.puzzle ?? puzzle; },
        intro,
        example,
        get puzzleDay() { return puzzleDay; },
        get puzzleLevel() { return level; },
        get puzzlesOpened() { return puzzlesOpened + intro.practiceChanges; },
        get puzzlesSolved() { return puzzlesSolved; },
        get canRestartPuzzle() { return phase === 'playing' && puzzle !== undefined && intro.practice === undefined; },
        openPuzzle(day) {
            if (phase !== 'calendar' || !calendar.isPlayable(day)) return;
            level = calendar.level;
            opened = generate({ seed: findPuzzleSeed(day, level), level: GENERATOR_LEVELS[level] });
            puzzle = createPuzzleModel({ givens: opened.givens, solution: opened.solution, saved: records.readPuzzle(day, level) });
            puzzleDay = day;
            keptChanges = puzzle.changes;
            puzzlesOpened++;
            phase = 'playing';
        },
        closePuzzle() {
            intro.close();
            if (phase !== 'playing') return;
            model.keepProgress();
            puzzle = undefined;
            phase = 'calendar';
        },
        restartPuzzle() {
            if (opened === undefined || !model.canRestartPuzzle) return;
            // It counts as opened afresh, so the views draw it afresh
            puzzle = createPuzzleModel({ givens: opened.givens, solution: opened.solution });
            // Nothing is kept until the player's next move, so the calendar no longer shows it started
            records.forgetPuzzle(puzzleDay, level);
            keptChanges = puzzle.changes;
            puzzlesOpened++;
        },
        keepProgress() {
            if (puzzle === undefined || puzzle.changes === keptChanges) return;
            keptChanges = puzzle.changes;
            records.writePuzzle(puzzleDay, level, puzzle.save());
            if (puzzle.isSolved && !records.isSolved(puzzleDay, level)) {
                records.markSolved(puzzleDay, level);
                puzzlesSolved++;
            }
        },
        update(deltaMs) {
            intro.update(deltaMs);
            model.keepProgress();
        },
    };
    if (options.offersIntro) intro.showCardIfNew();
    return model;

    /** A new practice puzzle, the same every time, for the walkthrough. It is never kept. */
    function createPractice(): SudokuPractice {
        const { givens, solution } = generate({ seed: PRACTICE_SEED, level: PRACTICE_LEVEL });
        return { puzzle: createPuzzleModel({ givens, solution }), solution };
    }
}
