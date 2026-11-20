import type { LocalStore } from '@mvtjs/site-kit/storage';
import { createDailyCalendar, createDailyRecords, createIntroModel, type DailyCalendar, type IntroModel, type PuzzleLevel } from '../../../shared';
import { findPuzzleSeed } from './find-puzzle-seed';
import { LEVEL_SETTINGS, BOAT_LEVELS } from './levels';
import { EXAMPLE_SEED, EXAMPLE_SETTINGS, FIRST_DAY, PRACTICE_SEED, PRACTICE_SETTINGS, STARTING_LEVEL } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { createBoatPuzzle, type BoatPuzzle } from './boat-puzzle';
import { BOATS_WALKTHROUGH, type BoatsTarget } from './boats-walkthrough';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What is on screen: the calendar of days to choose from, or a puzzle being played. */
export type BoatsPhase = 'calendar' | 'playing';

/**
 * A harbour of boats for each day, at each level. Every player gets the
 * same puzzles on the same day, as each is made from a seed worked out from
 * its date and its level. Each puzzle's progress, and which are solved, are
 * kept between visits.
 *
 * The way in is the one every puzzle on the site has: a card that says how
 * to play, over a puzzle, solved, as a player first opens the game, and a
 * walkthrough of the controls, on a practice puzzle, which stands in for
 * the puzzle open until it ends, and is never kept.
 */
export interface GameModel {
    /** What is on screen. It is `playing` while a walkthrough plays, wherever it was started from. */
    readonly phase: BoatsPhase;
    /** The calendar of days to choose from, at each level. */
    readonly calendar: DailyCalendar<PuzzleLevel>;
    /** The puzzle being played, while one is: the practice puzzle while the walkthrough plays. */
    readonly puzzle: PuzzleModel | undefined;
    /** The way in: the card that says how to play, and the walkthrough. */
    readonly intro: IntroModel<PuzzleModel, BoatsTarget>;
    /** The puzzle the card shows, solved. */
    readonly example: BoatPuzzle;
    /** The day of the puzzle being played, or of the last one played. */
    readonly puzzleDay: number;
    /** The level of the puzzle being played, or of the last one played. */
    readonly puzzleLevel: PuzzleLevel;
    /**
     * The number of puzzles opened on this visit. It rises each time the
     * puzzle shown changes, which happens when a puzzle is opened or started
     * again, and when a walkthrough starts or ends.
     */
    readonly puzzlesOpened: number;
    /** Puzzles solved on this visit. */
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
    /** Moves the walkthrough on, and keeps the puzzle's progress if it changed. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** What the game is created with. */
export interface GameModelOptions {
    /** Today's date where the player is, numbered from 1 January 1970. The page reads the clock and passes the day in. */
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
    const records = createDailyRecords({ store: options.store, gameId: 'boats', levels: BOAT_LEVELS });
    const calendar = createDailyCalendar({ today: options.today, firstDay: FIRST_DAY, levels: BOAT_LEVELS, startingLevel: STARTING_LEVEL, records });
    const intro = createIntroModel({ records, createPractice, ...BOATS_WALKTHROUGH });
    const example = createBoatPuzzle({ seed: EXAMPLE_SEED, settings: EXAMPLE_SETTINGS });

    let phase: BoatsPhase = 'calendar';
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
        get puzzlesOpened() { return puzzlesOpened + intro.practiceChanges; },
        get puzzlesSolved() { return puzzlesSolved; },
        get canRestartPuzzle() { return phase === 'playing' && puzzle !== undefined && intro.practice === undefined; },
        openPuzzle(day) {
            if (phase !== 'calendar' || !calendar.isPlayable(day)) return;
            const settings = LEVEL_SETTINGS[calendar.level];
            puzzleDay = day;
            puzzleLevel = calendar.level;
            const harbour = createBoatPuzzle({ seed: findPuzzleSeed(day, puzzleLevel), settings });
            puzzle = createPuzzleModel({ puzzle: harbour, saved: records.readPuzzle(day, puzzleLevel) });
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
            // Nothing is kept until the player's next move, so the calendar no longer shows it started
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

    /** A new practice puzzle, the same every time, for the walkthrough. It is never kept. */
    function createPractice(): PuzzleModel {
        return createPuzzleModel({ puzzle: createBoatPuzzle({ seed: PRACTICE_SEED, settings: PRACTICE_SETTINGS }) });
    }
}
