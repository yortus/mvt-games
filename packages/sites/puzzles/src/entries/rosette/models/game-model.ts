import type { LocalStore } from '@mvtjs/site-kit/storage';
import {
    createDailyCalendar, createDailyRecords, createIntroModel, type DailyCalendar, type IntroModel, PUZZLE_LEVELS, type PuzzleLevel,
} from '../../../shared';
import { findDayFrame } from './find-day-frame';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS } from './levels';
import { type GlassWindow, createGlassWindow } from './glass-window';
import {
    EXAMPLE_FRAME, EXAMPLE_SEED, EXAMPLE_SETTINGS, FIRST_DAY, PRACTICE_FRAME, PRACTICE_SEED, PRACTICE_SETTINGS, STARTING_LEVEL,
} from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { ROSETTE_WALKTHROUGH, type RosetteTarget } from './rosette-walkthrough';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What is on screen: the calendar of days to choose from, or a puzzle being played. */
export type RosettePhase = 'calendar' | 'playing';

/**
 * A picture to put back together for each day, at each of four levels.
 * Every player gets the same puzzles on the same day, as each is made from
 * a seed worked out from its date and its level, in the day's frame. Each puzzle's progress,
 * and which are solved, are kept between visits.
 *
 * The way in is the one every puzzle on the site has: a card that says how
 * to play, over a small picture, solved, as a player first opens the game,
 * and a walkthrough of swapping, on a practice picture, which stands in for
 * the puzzle open until it ends, and is never kept.
 */
export interface GameModel {
    /** What is on screen. It is `playing` while a walkthrough plays, wherever it was started from. */
    readonly phase: RosettePhase;
    /** The calendar of days to choose from, at each level. */
    readonly calendar: DailyCalendar<PuzzleLevel>;
    /** The puzzle being played, while one is: the practice picture while the walkthrough plays. */
    readonly puzzle: PuzzleModel | undefined;
    /** The way in: the card that says how to play, and the walkthrough. */
    readonly intro: IntroModel<PuzzleModel, RosetteTarget>;
    /** The small picture the card shows, solved. */
    readonly example: GlassWindow;
    /** The day and level of the puzzle being played, or the last one played. */
    readonly puzzleDay: number;
    readonly puzzleLevel: PuzzleLevel;
    /** Puzzles opened, and solved, on this visit. */
    readonly puzzlesOpened: number;
    readonly puzzlesSolved: number;
    /** Whether there is a puzzle to start again: one of the calendar's, open, and not the walkthrough's practice puzzle. */
    readonly canRestartPuzzle: boolean;

    /** Opens `day`'s puzzle at the calendar's level, as it was left, if the day has one. */
    openPuzzle: (day: number) => void;
    /** Puts the way in away, keeps the puzzle's progress, and goes back to the calendar. */
    closePuzzle: () => void;
    /**
     * Starts the open puzzle again, jumbled as it was made, and forgets its
     * progress, so it no longer counts as started until the next swap. Its
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
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the game on the calendar, at this month, at the level chosen last. */
export function createGameModel(options: GameModelOptions): GameModel {
    const records = createDailyRecords({ store: options.store, gameId: 'rosette', levels: PUZZLE_LEVELS });
    const calendar = createDailyCalendar({ today: options.today, firstDay: FIRST_DAY, levels: PUZZLE_LEVELS, startingLevel: STARTING_LEVEL, records });
    const intro = createIntroModel({ records, createPractice, ...ROSETTE_WALKTHROUGH });
    const example = createGlassWindow({ seed: EXAMPLE_SEED, settings: EXAMPLE_SETTINGS, frame: EXAMPLE_FRAME });

    let phase: RosettePhase = 'calendar';
    let puzzle: PuzzleModel | undefined;
    let puzzleDay = options.today;
    let puzzleLevel = calendar.level;
    let keptChanges = 0;
    let puzzlesOpened = 0;
    let puzzlesSolved = 0;

    const model: GameModel = {
        // A walkthrough plays on the puzzle's screen, even one started from the calendar
        get phase() { return intro.practice === undefined ? phase : 'playing'; },
        calendar,
        get puzzle() { return intro.practice ?? puzzle; },
        intro,
        example,
        get puzzleDay() { return puzzleDay; },
        get puzzleLevel() { return puzzleLevel; },
        get puzzlesOpened() { return puzzlesOpened; },
        get puzzlesSolved() { return puzzlesSolved; },
        get canRestartPuzzle() { return phase === 'playing' && puzzle !== undefined && intro.practice === undefined; },
        openPuzzle(day) {
            if (phase !== 'calendar' || !calendar.isPlayable(day)) return;
            puzzleDay = day;
            puzzleLevel = calendar.level;
            const made = createGlassWindow({
                seed: findPuzzleSeed(day, puzzleLevel), settings: LEVEL_SETTINGS[puzzleLevel], frame: findDayFrame(day),
            });
            puzzle = createPuzzleModel({ puzzle: made, saved: records.readPuzzle(day, puzzleLevel) });
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
            if (puzzle === undefined || !model.canRestartPuzzle) return;
            // A fresh copy of the same puzzle counts as opened, so the views draw it afresh
            puzzle = createPuzzleModel({ puzzle: puzzle.puzzle });
            // Nothing is kept until the player's next swap, so the calendar no longer shows it started
            records.forgetPuzzle(puzzleDay, puzzleLevel);
            keptChanges = puzzle.changes;
            puzzlesOpened++;
        },
        keepProgress() {
            if (puzzle === undefined || puzzle.changes === keptChanges) return;
            keptChanges = puzzle.changes;
            records.writePuzzle(puzzleDay, puzzleLevel, puzzle.save());
            if (puzzle.isSolved && !records.isSolved(puzzleDay, puzzleLevel)) {
                records.markSolved(puzzleDay, puzzleLevel);
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

    /** A new practice picture, the same every time, for the walkthrough. It is never kept. */
    function createPractice(): PuzzleModel {
        return createPuzzleModel({ puzzle: createGlassWindow({ seed: PRACTICE_SEED, settings: PRACTICE_SETTINGS, frame: PRACTICE_FRAME }) });
    }
}
