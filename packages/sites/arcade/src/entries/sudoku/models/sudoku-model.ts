import type { LocalStore } from '../../../storage';
import type { Level, SudokuGenerator } from '#sudoku-digger';
import { countDaysInMonth, findWeekday, toCalendarDate, toDayNumber } from './day-numbers';
import { findPuzzleSeed } from './find-puzzle-seed';
import { FIRST_DAY, PRACTICE_LEVEL, PRACTICE_SEED, STARTING_LEVEL } from './model-constants';
import { createPuzzleModel, type PuzzleModel } from './puzzle-model';
import { createSudokuRecords } from './sudoku-records';
import { createTutorialModel, type TutorialModel } from './tutorial-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What is on screen: the calendar of days to choose from, or a puzzle being played. */
export type SudokuPhase = 'calendar' | 'playing';

/**
 * A puzzle for each day, at each of five levels. Every player gets the same
 * puzzles on the same day, as each is made from a seed worked out from its
 * date and its level. Any day from the first to today can be
 * played, but no day after today. Each puzzle's progress, and which are
 * solved, are kept between visits. Days are numbered from 1 January 1970.
 *
 * The tutorial walks the player through making notes on a practice puzzle,
 * which stands in for the puzzle open until the tutorial ends, and is never
 * kept. It plays the first time a player opens a puzzle, and again when
 * they ask.
 */
export interface SudokuModel {
    readonly phase: SudokuPhase;
    /** Today, where the player is: the last day with a puzzle. */
    readonly today: number;
    /** The level the calendar shows, and the puzzles it opens are at. */
    readonly level: Level;
    /** The month the calendar shows. Its month runs from 1 to 12. */
    readonly shownYear: number;
    readonly shownMonth: number;
    /** Whether the calendar can go back a month, or on one. It goes no earlier than the first day's month, nor later than today's. */
    readonly canShowEarlierMonth: boolean;
    readonly canShowLaterMonth: boolean;
    /** The day in slot `slot` of the month's page, six weeks of seven from a Monday, or -1 for a slot outside the month. */
    readonly dayInSlot: (slot: number) => number;
    /** Whether `day` has a puzzle to play: it is no earlier than the first day, and no later than today. */
    readonly isPlayable: (day: number) => boolean;
    /** Whether `day`'s puzzle at the chosen level is solved, or started. */
    readonly isSolved: (day: number) => boolean;
    readonly isStarted: (day: number) => boolean;
    /** How many days' puzzles are solved at the chosen level. */
    readonly solvedCount: number;
    /** The puzzle being played, while one is: the practice puzzle while the tutorial plays. */
    readonly puzzle: PuzzleModel | undefined;
    /** The tutorial, while it plays. */
    readonly tutorial: TutorialModel | undefined;
    /** The day of the puzzle being played, or the last one played. */
    readonly puzzleDay: number;
    /** Puzzles opened, and solved, on this visit. The practice puzzle counts as opened, as the tutorial starts and ends. */
    readonly puzzlesOpened: number;
    readonly puzzlesSolved: number;

    chooseLevel: (level: Level) => void;
    showEarlierMonth: () => void;
    showLaterMonth: () => void;
    /** Opens `day`'s puzzle at the chosen level, as it was left, if the day has one. The first time, the tutorial plays first. */
    openPuzzle: (day: number) => void;
    /** Plays the tutorial, on a practice puzzle, while a puzzle is open. */
    startTutorial: () => void;
    /** Ends the tutorial, finished or skipped, and goes back to the puzzle that was open. It won't play by itself again. */
    endTutorial: () => void;
    /** Keeps the puzzle's progress, and goes back to the calendar. */
    closePuzzle: () => void;
    /** Keeps the puzzle's progress now, if it changed since it was last kept, and ticks it off once it is solved. */
    keepProgress: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SudokuModelOptions {
    /** Today's date where the player is, numbered from 1 January 1970. The page reads the clock, and the model takes the day it gives. */
    readonly today: number;
    /** Where the progress and the solved puzzles are kept. */
    readonly store: LocalStore;
    /** Whether the tutorial plays by itself the first time a player opens a puzzle. Tests and the thumbnail leave it out. */
    readonly offersTutorial: boolean;
    /** Makes a puzzle from a seed, at a level: Sudoku Digger's puzzle maker. */
    readonly generate: SudokuGenerator;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the game on the calendar, at this month, at the level chosen last. */
export function createSudokuModel(options: SudokuModelOptions): SudokuModel {
    const { today, generate } = options;
    const records = createSudokuRecords({ store: options.store });
    const todayDate = toCalendarDate(today);
    const firstDate = toCalendarDate(FIRST_DAY);

    let phase: SudokuPhase = 'calendar';
    let level = records.chosenLevel ?? STARTING_LEVEL;
    let shownYear = todayDate.year;
    let shownMonth = todayDate.month;
    // The shown month's first day, the slot it is in, and how many days it has
    let monthStart = 0;
    let firstSlot = 0;
    let monthLength = 0;
    let puzzle: PuzzleModel | undefined;
    // While the tutorial plays: it, and the puzzle it stands in for
    let tutorial: TutorialModel | undefined;
    let waitingPuzzle: PuzzleModel | undefined;
    let puzzleDay = today;
    let keptChanges = 0;
    let puzzlesOpened = 0;
    let puzzlesSolved = 0;
    findMonth();

    const model: SudokuModel = {
        get phase() { return phase; },
        today,
        get level() { return level; },
        get shownYear() { return shownYear; },
        get shownMonth() { return shownMonth; },
        get canShowEarlierMonth() { return shownYear * 12 + shownMonth > firstDate.year * 12 + firstDate.month; },
        get canShowLaterMonth() { return shownYear * 12 + shownMonth < todayDate.year * 12 + todayDate.month; },
        dayInSlot: (slot) => (slot < firstSlot || slot >= firstSlot + monthLength ? -1 : monthStart + slot - firstSlot),
        isPlayable,
        isSolved: (day) => records.isSolved(day, level),
        isStarted: (day) => records.isStarted(day, level),
        get solvedCount() { return records.countSolved(level); },
        get puzzle() { return puzzle; },
        get tutorial() { return tutorial; },
        get puzzleDay() { return puzzleDay; },
        get puzzlesOpened() { return puzzlesOpened; },
        get puzzlesSolved() { return puzzlesSolved; },
        chooseLevel(next) {
            if (phase !== 'calendar' || next === level) return;
            level = next;
            records.rememberLevel(next);
        },
        showEarlierMonth() {
            if (!model.canShowEarlierMonth) return;
            shownYear = shownMonth === 1 ? shownYear - 1 : shownYear;
            shownMonth = shownMonth === 1 ? 12 : shownMonth - 1;
            findMonth();
        },
        showLaterMonth() {
            if (!model.canShowLaterMonth) return;
            shownYear = shownMonth === 12 ? shownYear + 1 : shownYear;
            shownMonth = shownMonth === 12 ? 1 : shownMonth + 1;
            findMonth();
        },
        openPuzzle(day) {
            if (phase !== 'calendar' || !isPlayable(day)) return;
            const { givens, solution } = generate({ seed: findPuzzleSeed(day, level), level });
            puzzle = createPuzzleModel({ givens, solution, saved: records.readPuzzle(day, level) });
            puzzleDay = day;
            keptChanges = puzzle.changes;
            puzzlesOpened++;
            phase = 'playing';
            if (options.offersTutorial && !records.isTutorialSeen) model.startTutorial();
        },
        startTutorial() {
            if (phase !== 'playing' || tutorial !== undefined) return;
            model.keepProgress();
            const { givens, solution } = generate({ seed: PRACTICE_SEED, level: PRACTICE_LEVEL });
            waitingPuzzle = puzzle;
            puzzle = createPuzzleModel({ givens, solution });
            tutorial = createTutorialModel({ puzzle, solution });
            puzzlesOpened++;
        },
        endTutorial() {
            if (tutorial === undefined) return;
            records.markTutorialSeen();
            puzzle = waitingPuzzle;
            waitingPuzzle = undefined;
            tutorial = undefined;
            puzzlesOpened++;
        },
        closePuzzle() {
            if (phase !== 'playing') return;
            model.endTutorial();
            model.keepProgress();
            puzzle = undefined;
            phase = 'calendar';
        },
        keepProgress() {
            // The practice puzzle is never kept
            if (puzzle === undefined || tutorial !== undefined || puzzle.changes === keptChanges) return;
            keptChanges = puzzle.changes;
            records.writePuzzle(puzzleDay, level, puzzle.save());
            if (puzzle.isSolved && !records.isSolved(puzzleDay, level)) {
                records.markSolved(puzzleDay, level);
                puzzlesSolved++;
            }
        },
        update(deltaMs) {
            tutorial?.update(deltaMs);
            model.keepProgress();
        },
    };
    return model;

    function isPlayable(day: number): boolean {
        return day >= FIRST_DAY && day <= today;
    }

    function findMonth(): void {
        monthStart = toDayNumber({ year: shownYear, month: shownMonth, day: 1 });
        firstSlot = findWeekday(monthStart);
        monthLength = countDaysInMonth(shownYear, shownMonth);
    }
}
