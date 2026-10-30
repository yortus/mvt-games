import { type Level, LEVELS } from '../data';
import { swapColumns, swapDigits, swapStacks, turnGrid } from './grid-shuffles';
import { createLogicGrader, type Technique } from './logic-grader';
import {
    DIG_CHOSEN_MS, DIG_DUG_MS, DIG_ENDED_MS, DIG_HELD_MS, DIG_NEEDED_MS, DIG_TEST_FAILED_MS, DIG_TESTING_MS, FASTEST_MOVE_MS,
    FILL_MOVE_BUDGET, FILL_MOVE_MS, FILLED_MS, FINISHED_MS, GAVE_UP_MS, GRID_CHOSEN_MS, GRID_TRIED_MS, LEVEL_SETTINGS, MARKED_MS, MAX_GRIDS_TRIED, MOVE_SPEED_UP, PLAYBACK_RATE,
    SEED_COUNT, SEED_MS, SHUFFLE_COUNT, SHUFFLE_MS, STUCK_MS, TECHNIQUE_LEVEL, TECHNIQUE_MS, TEST_MOVE_MS,
} from './model-constants';
import { createRandom } from './random';
import { createStepSolver } from './step-solver';
import { CELL_COUNT, COLUMN_OF, countDigits, findCandidates, lowestDigit, pickDigit, ROW_OF, toDigitSet } from './sudoku-rules';
import { writeDigOrder } from './write-dig-order';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Where the making of a puzzle has got to: trying whole puzzles out of
 * sight until one comes out at the level asked for, then, for the one
 * chosen, placing random digits, searching for a full grid from them,
 * digging cells out of it, shuffling the result, grading it by solving it
 * as a person would, and showing it finished.
 */
export type DiggerPhase = 'trying' | 'seeding' | 'filling' | 'digging' | 'shuffling' | 'grading' | 'finished';

/** How fast the making runs: stopped, at a quarter speed, at normal speed, or four times as fast. */
export type Playback = 'paused' | 'slow' | 'normal' | 'fast';

/**
 * Where a cell's digit came from: a given (one of the puzzle's, or a seed),
 * the search, the digit being tested in the cell being dug, or the grader's
 * reasoning.
 */
export type CellKind = 'empty' | 'given' | 'search' | 'test' | 'logic';

/**
 * What digging made of a cell: dug out, needed (another digit there would
 * give a second solution), or held (its row or column can't spare another
 * given). `none` is a cell not yet tried, or kept because the puzzle
 * reached its target first.
 */
export type DigMark = 'none' | 'dug' | 'needed' | 'held';

/** The ways the dug puzzle is shuffled: two digits swapped, two columns of a stack, two stacks, and a quarter turn. */
export type ShuffleKind = 'digits' | 'columns' | 'stacks' | 'turn';

/**
 * What the last step did. A view captions it, and uses it with the model's
 * other state to show what happened.
 *
 * - `grid-tried`: a whole puzzle was made and graded out of sight. If it
 *   came out at the level asked for, or the tries ran out, it is the one
 *   chosen, and its making is shown next.
 * - `seed-placed`: a random digit went into an empty cell.
 * - `search-tried`, `search-retreated`: the search put a digit in a cell,
 *   or took one out at a dead end. The phase says what the search is for.
 * - `fill-gave-up`: the search ran past its budget, so the grid is wiped.
 * - `fill-solved`: the search filled the grid.
 * - `dig-chosen`: the next cell in the dig order is up.
 * - `dig-held`: its row or column can't spare another given, so it stays.
 * - `dig-only-digit`: no other digit fits it, so it is dug out.
 * - `dig-testing`: another digit is put in it, and the search starts.
 * - `dig-test-failed`: with that digit, the puzzle has no solution.
 * - `dig-needed`: with that digit, the puzzle has a solution, so the cell
 *   stays.
 * - `dig-dug`: no other digit gave a solution, so it is dug out.
 * - `dig-enough`: the puzzle has come down to its target givens.
 * - `dig-done`: every cell has been tried.
 * - `shuffled`: one shuffle was made.
 * - `grade-marked`: the grader has pencilled in every digit that could go
 *   in each empty cell.
 * - `grade-step`: the grader took a step of reasoning.
 * - `grade-stuck`: no technique the grader knows makes progress, so the
 *   search finishes the puzzle.
 * - `finished`: the puzzle is made and graded.
 */
export type StepKind =
    | 'started'
    | 'grid-tried'
    | 'seed-placed'
    | 'search-tried'
    | 'search-retreated'
    | 'fill-gave-up'
    | 'fill-solved'
    | 'dig-chosen'
    | 'dig-held'
    | 'dig-only-digit'
    | 'dig-testing'
    | 'dig-test-failed'
    | 'dig-needed'
    | 'dig-dug'
    | 'dig-enough'
    | 'dig-done'
    | 'shuffled'
    | 'grade-marked'
    | 'grade-step'
    | 'grade-stuck'
    | 'finished';

/**
 * Makes Sudoku puzzles one after another, one step at a time, at a pace
 * that can be watched. Each step holds the screen for a while, longer for
 * the steps worth reading, and the playback scales that time. Time reaches
 * it only through `update`, and its random numbers come from its seed, so
 * the same seed and the same updates make the same puzzles.
 *
 * Most puzzles come out easier than the level they are dug for. So for
 * each puzzle, the model first makes whole puzzles out of sight, one a
 * step, until one comes out at the level asked for. Then it winds its
 * random numbers back to where that puzzle began, and makes it again, step
 * by step, in sight.
 *
 * Cells are numbered across each row from the top left, 0 to 80. Digits are
 * 1 to 9, and 0 is an empty cell. A set of digits is a mask with bit `d` set
 * for each digit `d` in it.
 */
export interface DiggerModel {
    /** The level the current puzzle is being dug for. */
    readonly level: Level;
    readonly phase: DiggerPhase;
    playback: Playback;
    readonly stepKind: StepKind;
    /** Steps taken since the model was made. It rises with every step. */
    readonly stepCount: number;
    /** How far through its time on screen the last step is, from 0 to 1. */
    readonly stepProgress: number;

    /** The digit to show in `cell`, or 0. */
    digitAt: (cell: number) => number;
    cellKindAt: (cell: number) => CellKind;
    digMarkAt: (cell: number) => DigMark;
    /** While grading, the pencil marks of an empty cell: the digits that could still go there. Otherwise 0. */
    candidatesAt: (cell: number) => number;
    /** While grading, the pencil marks the last step rubbed out of `cell`. Otherwise 0. */
    eliminatedAt: (cell: number) => number;
    /** While grading, whether the last step's reasoning rests on `cell`. */
    isHighlightedAt: (cell: number) => boolean;
    /**
     * While a second solution shows, as a cell being dug turns out to be
     * needed, whether `cell` holds a different digit in it than in the full
     * grid. Those cells are what lets the puzzle be solved two ways.
     */
    isDifferentAt: (cell: number) => boolean;
    /** The digit the full grid holds in `cell`, once the grid is filled, or 0. */
    fullGridDigitAt: (cell: number) => number;

    /** The cell being dug, or -1. */
    readonly focusCell: number;
    /** The digit the cell being dug held in the full grid. */
    readonly originalDigit: number;
    /** The other digit being tried in the cell being dug, or 0. */
    readonly testDigit: number;
    /**
     * The cell whose other digits are being tried, from the moment it is
     * emptied to the verdict on it, or -1.
     */
    readonly testedCell: number;
    /** The digits other than its own that could go in the tested cell, each to be tried. */
    readonly rivalDigits: number;
    /** The rival digits tried so far that led nowhere. */
    readonly ruledOutDigits: number;
    /** The cell and digit of the search's last move, or -1 and 0. */
    readonly lastSearchCell: number;
    readonly lastSearchDigit: number;
    /** The cell and digit the last seed went into. */
    readonly lastSeedCell: number;
    readonly lastSeedDigit: number;
    /** The cell found needed last, or -1. */
    readonly lastNeededCell: number;
    /** The cell dug out last, and the digit it held, or -1 and 0. */
    readonly lastDugCell: number;
    readonly lastDugDigit: number;

    // Counts for this puzzle. Each rises at a moment worth a sound
    readonly seedsPlaced: number;
    readonly searchTries: number;
    readonly searchRetreats: number;
    /** Times the search gave up filling the grid, and started again from new seeds. */
    readonly restarts: number;
    /** Digits tested in cells being dug. */
    readonly testsRun: number;
    /** Digits tested in cells being dug that led nowhere. */
    readonly testsFailed: number;
    readonly cellsDug: number;
    readonly cellsNeeded: number;
    readonly cellsHeld: number;
    readonly shufflesDone: number;
    /** The grader's steps that placed a digit, and those that only rubbed out pencil marks. */
    readonly logicPlacements: number;
    readonly logicReductions: number;
    /** Puzzles finished since the model was made. */
    readonly puzzlesFinished: number;

    /** How many givens the puzzle has: 81 until digging starts. */
    readonly givensCount: number;
    /** The fewest givens this puzzle keeps, chosen as digging starts. */
    readonly givensTarget: number;
    /** The fewest givens any row or column keeps, for this level. */
    readonly fewestPerLine: number;
    givensInRow: (row: number) => number;
    givensInColumn: (column: number) => number;

    /** The last shuffle, and what it swapped: two digits, two columns, or two stacks, 0 to 2. */
    readonly shuffleKind: ShuffleKind | undefined;
    readonly shuffleFirst: number;
    readonly shuffleSecond: number;

    /** The technique of the grader's last step, or undefined. */
    readonly technique: Technique | undefined;
    /** The unit the grader's last step reasoned about, or -1: rows 0 to 8, columns 9 to 17, boxes 18 to 26. */
    readonly techniqueUnit: number;
    /** The cell the grader's last step filled, or -1 if it only rubbed out pencil marks. */
    readonly techniqueCell: number;
    /** The digit the grader's last step placed, or was about. */
    readonly techniqueDigit: number;
    /** The hardest technique the grader has needed for this puzzle. */
    readonly hardestTechnique: Technique | undefined;
    /** Whether the grader got stuck, so the puzzle needs guesswork. */
    readonly needsGuessing: boolean;
    /** The level the puzzle came out at, once it is graded. */
    readonly grade: Level | undefined;

    /** Puzzles tried out of sight for this one so far, the one chosen among them. */
    readonly gridsTried: number;
    /**
     * Whether a puzzle has been chosen from those tried: the first to come out
     * at the level asked for, or, if none did before the tries ran out, the
     * one that came nearest.
     */
    readonly isGridChosen: boolean;
    /** The level the last puzzle tried came out at, or the chosen one's once it is chosen. */
    readonly triedGrade: Level | undefined;

    /** Starts a new puzzle, for `level`, at the next update. */
    chooseLevel: (level: Level) => void;
    /** Starts a new puzzle for the current level, at the next update. */
    makeNewPuzzle: () => void;
    /** Takes one more step at the next update, whatever the playback. For stepping while paused. */
    step: () => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DiggerModelOptions {
    /** Any whole number. The same seed makes the same puzzles. */
    readonly seed: number;
    /** The level of the first puzzle. Each puzzle after it is a level harder, and Evil is followed by Easiest. Defaults to Easy. */
    readonly level?: Level;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a model that starts making its first puzzle at its first update. */
export function createDiggerModel(options: DiggerModelOptions): DiggerModel {
    const random = createRandom({ seed: options.seed });
    const solver = createStepSolver({ random });
    const grader = createLogicGrader();

    // The grid as it is made: the seeds, the full grid, and the puzzle dug from it
    const seeds = new Uint8Array(CELL_COUNT);
    const solution = new Uint8Array(CELL_COUNT);
    const puzzle = new Uint8Array(CELL_COUNT);
    const marks = new Uint8Array(CELL_COUNT);
    const digOrder = new Uint8Array(CELL_COUNT);
    const rowGivens = new Uint8Array(9);
    const columnGivens = new Uint8Array(9);
    const scratch = new Uint8Array(CELL_COUNT);
    // What each cell shows, brought up to date after every step
    const shownDigits = new Uint8Array(CELL_COUNT);
    const shownKinds = new Uint8Array(CELL_COUNT);

    let level: Level = options.level ?? 'easy';
    let phase: DiggerPhase = 'seeding';
    let stage: Stage = 'seed';
    let stepKind: StepKind = 'started';
    let stepCount = 0;
    let holdMs = 0;
    let holdTotalMs = 0;
    let pendingLevel: Level | undefined = level;
    let pendingSteps = 0;

    let focusCell = -1;
    let originalDigit = 0;
    let testDigit = 0;
    let digitsToTest = 0;
    let testedCell = -1;
    let rivalDigits = 0;
    let ruledOutDigits = 0;
    let digIndex = 0;
    let isShowingSearch = false;
    let lastSearchCell = -1;
    let lastSearchDigit = 0;
    let lastSeedCell = -1;
    let lastSeedDigit = 0;
    let lastNeededCell = -1;
    let lastDugCell = -1;
    let lastDugDigit = 0;
    let seedsInGrid = 0;

    let seedsPlaced = 0;
    let searchTries = 0;
    let searchRetreats = 0;
    let restarts = 0;
    let testsRun = 0;
    let testsFailed = 0;
    let cellsDug = 0;
    let cellsNeeded = 0;
    let cellsHeld = 0;
    let shufflesDone = 0;
    let puzzlesFinished = 0;

    let givensCount = CELL_COUNT;
    let givensTarget = 0;
    let shuffleKind: ShuffleKind | undefined;
    let shuffleFirst = 0;
    let shuffleSecond = 0;
    let needsGuessing = false;
    let grade: Level | undefined;

    // The puzzles tried out of sight, and the random numbers' state as the nearest to the level asked for began
    let gridsTried = 0;
    let isGridChosen = false;
    let triedGrade: Level | undefined;
    let nearestDistance = Infinity;
    let nearestGrade: Level | undefined;
    let nearestRandomState = 0;

    const model: DiggerModel = {
        get level() { return level; },
        get phase() { return phase; },
        playback: 'normal',
        get stepKind() { return stepKind; },
        get stepCount() { return stepCount; },
        get stepProgress() { return holdTotalMs > 0 ? 1 - holdMs / holdTotalMs : 1; },

        digitAt: (cell) => shownDigits[cell],
        cellKindAt: (cell) => CELL_KINDS[shownKinds[cell]],
        digMarkAt: (cell) => DIG_MARKS[marks[cell]],
        candidatesAt: (cell) => (isGrading() && shownDigits[cell] === 0 ? grader.candidates[cell] : 0),
        eliminatedAt: (cell) => (isGrading() && stepKind === 'grade-step' ? grader.eliminated[cell] : 0),
        isHighlightedAt: (cell) => isGrading() && stepKind === 'grade-step' && grader.isHighlightedAt(cell),
        isDifferentAt: (cell) => stepKind === 'dig-needed' && isShowingSearch && solver.digits[cell] !== solution[cell],
        fullGridDigitAt: (cell) => solution[cell],

        get focusCell() { return focusCell; },
        get originalDigit() { return originalDigit; },
        get testDigit() { return testDigit; },
        get testedCell() { return testedCell; },
        get rivalDigits() { return rivalDigits; },
        get ruledOutDigits() { return ruledOutDigits; },
        get lastSearchCell() { return lastSearchCell; },
        get lastSearchDigit() { return lastSearchDigit; },
        get lastSeedCell() { return lastSeedCell; },
        get lastSeedDigit() { return lastSeedDigit; },
        get lastNeededCell() { return lastNeededCell; },
        get lastDugCell() { return lastDugCell; },
        get lastDugDigit() { return lastDugDigit; },

        get seedsPlaced() { return seedsPlaced; },
        get searchTries() { return searchTries; },
        get searchRetreats() { return searchRetreats; },
        get restarts() { return restarts; },
        get testsRun() { return testsRun; },
        get testsFailed() { return testsFailed; },
        get cellsDug() { return cellsDug; },
        get cellsNeeded() { return cellsNeeded; },
        get cellsHeld() { return cellsHeld; },
        get shufflesDone() { return shufflesDone; },
        get logicPlacements() { return grader.placements; },
        get logicReductions() { return grader.reductions; },
        get puzzlesFinished() { return puzzlesFinished; },

        get givensCount() { return givensCount; },
        get givensTarget() { return givensTarget; },
        get fewestPerLine() { return LEVEL_SETTINGS[level].fewestPerLine; },
        givensInRow: (row) => rowGivens[row],
        givensInColumn: (column) => columnGivens[column],

        get shuffleKind() { return shuffleKind; },
        get shuffleFirst() { return shuffleFirst; },
        get shuffleSecond() { return shuffleSecond; },

        get technique() { return isGrading() && stepKind === 'grade-step' ? grader.lastTechnique : undefined; },
        get techniqueUnit() { return grader.lastUnit; },
        get techniqueCell() { return grader.lastCell; },
        get techniqueDigit() { return grader.lastDigit; },
        get hardestTechnique() { return grader.hardest; },
        get needsGuessing() { return needsGuessing; },
        get grade() { return grade; },

        get gridsTried() { return gridsTried; },
        get isGridChosen() { return isGridChosen; },
        get triedGrade() { return triedGrade; },

        chooseLevel(next) { pendingLevel = next; },
        makeNewPuzzle() { pendingLevel = level; },
        step() { pendingSteps++; },
        update,
    };
    return model;

    function update(deltaMs: number): void {
        if (pendingLevel !== undefined) {
            startPuzzle(pendingLevel);
            pendingLevel = undefined;
        }
        for (; pendingSteps > 0; pendingSteps--) takeStep();
        let msToRun = deltaMs * PLAYBACK_RATE[model.playback];
        // The search's moves can be short, so many may run in one update. The limit only guards against a stall
        for (let i = 0; i < MAX_STEPS_PER_UPDATE && msToRun > 0; i++) {
            if (holdMs > msToRun) {
                holdMs -= msToRun;
                return;
            }
            msToRun -= holdMs;
            takeStep();
        }
    }

    function startPuzzle(next: Level): void {
        level = next;
        phase = 'trying';
        stage = 'try';
        stepKind = 'started';
        holdMs = 0;
        holdTotalMs = 0;
        gridsTried = 0;
        isGridChosen = false;
        triedGrade = undefined;
        nearestDistance = Infinity;
        nearestGrade = undefined;
        resetRun();
        showCells();
    }

    /** Clears everything one making of a puzzle leaves behind, so the next starts afresh. */
    function resetRun(): void {
        seeds.fill(0);
        solution.fill(0);
        puzzle.fill(0);
        marks.fill(0);
        lastSearchCell = -1;
        lastSearchDigit = 0;
        lastSeedCell = -1;
        lastSeedDigit = 0;
        lastNeededCell = -1;
        lastDugCell = -1;
        lastDugDigit = 0;
        seedsInGrid = 0;
        givensTarget = 0;
        shuffleKind = undefined;
        grade = undefined;
        resetCounts();
        countGivens();
    }

    /** Sets this puzzle's counts back to nothing, and leaves nothing being dug, searched or graded. */
    function resetCounts(): void {
        // The grader's counts go with its puzzle, so it is given the puzzle afresh
        grader.start(puzzle);
        focusCell = -1;
        originalDigit = 0;
        testDigit = 0;
        testedCell = -1;
        rivalDigits = 0;
        ruledOutDigits = 0;
        isShowingSearch = false;
        seedsPlaced = 0;
        searchTries = 0;
        searchRetreats = 0;
        restarts = 0;
        testsRun = 0;
        testsFailed = 0;
        cellsDug = 0;
        cellsNeeded = 0;
        cellsHeld = 0;
        shufflesDone = 0;
        needsGuessing = false;
    }

    /** Takes the next step, and holds it on screen for as long as it deserves. */
    function takeStep(): void {
        let ms = runStage();
        // A stage with nothing to show hands on to the next one, in the same step
        while (ms < 0) ms = runStage();
        holdMs = ms;
        holdTotalMs = ms;
        stepCount++;
        showCells();
    }

    /** Runs the current stage once. Returns how long its step holds the screen, or -1 if it showed nothing. */
    function runStage(): number {
        switch (stage) {
            case 'try': return tryGrid();
            case 'replay': return replayChosenGrid();
            case 'seed': return placeSeed();
            case 'fill': return fillGrid();
            case 'dig-choose': return chooseCellToDig();
            case 'dig-check': return checkCellToDig();
            case 'dig-next-test': return startNextTest();
            case 'dig-test': return runTest();
            case 'shuffle': return shuffleOnce();
            case 'mark': return markCandidates();
            case 'grade': return gradeOneStep();
            case 'guess': return finishByGuessing();
            case 'finish': return finishPuzzle();
            case 'next': return startNextPuzzle();
        }
    }

    // --- Trying puzzles out of sight ---

    /** Makes and grades a whole puzzle in one step, and chooses it if it came out at the level asked for. */
    function tryGrid(): number {
        resetRun();
        const randomState = random.state;
        stage = 'seed';
        while (!isReadyToFinish()) runStage();
        const tried = findGrade();
        gridsTried++;
        const distance = Math.abs(LEVELS.indexOf(tried) - LEVELS.indexOf(level));
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestGrade = tried;
            nearestRandomState = randomState;
        }
        isGridChosen = distance === 0 || gridsTried === MAX_GRIDS_TRIED;
        triedGrade = isGridChosen ? nearestGrade : tried;

        // The tried puzzle stays on show. The counts its making left go back to nothing, so no view sees them rise
        resetCounts();
        phase = 'trying';
        stage = isGridChosen ? 'replay' : 'try';
        stepKind = 'grid-tried';
        return isGridChosen ? GRID_CHOSEN_MS : GRID_TRIED_MS;
    }

    /** Whether the puzzle is made and graded, and only its finish is left. */
    function isReadyToFinish(): boolean {
        return stage === 'finish';
    }

    /** Winds the random numbers back to where the chosen puzzle began, to make it again in sight. */
    function replayChosenGrid(): number {
        random.state = nearestRandomState;
        resetRun();
        stage = 'seed';
        return -1;
    }

    // --- Seeding and filling ---

    function placeSeed(): number {
        phase = 'seeding';
        isShowingSearch = false;
        if (seedsInGrid === SEED_COUNT) {
            solver.start(seeds, 'random');
            stage = 'fill';
            return -1;
        }
        // A random empty cell, and a random digit that breaks no rule there
        for (;;) {
            const cell = Math.floor(random.next() * CELL_COUNT);
            if (seeds[cell] !== 0) continue;
            const set = findCandidates(seeds, cell);
            if (set === 0) continue;
            seeds[cell] = pickDigit(set, Math.floor(random.next() * countDigits(set)));
            seedsInGrid++;
            seedsPlaced++;
            lastSeedCell = cell;
            lastSeedDigit = seeds[cell];
            stepKind = 'seed-placed';
            return SEED_MS;
        }
    }

    function fillGrid(): number {
        phase = 'filling';
        isShowingSearch = true;
        if (solver.status === 'searching' && solver.steps < FILL_MOVE_BUDGET) {
            solver.step();
            if (solver.lastMove !== 'none') return reportSearchMove(FILL_MOVE_MS);
        }
        if (solver.status === 'solved') {
            solution.set(solver.digits);
            puzzle.set(solution);
            const settings = LEVEL_SETTINGS[level];
            writeDigOrder(digOrder, settings.digOrder, random);
            digIndex = 0;
            givensTarget = settings.fewestGivens + Math.floor(random.next() * (settings.mostGivens - settings.fewestGivens + 1));
            countGivens();
            stage = 'dig-choose';
            stepKind = 'fill-solved';
            return FILLED_MS;
        }
        // The search ran past its budget, or the seeds have no solution: wipe the grid, and seed again
        restarts++;
        seeds.fill(0);
        seedsInGrid = 0;
        stage = 'seed';
        stepKind = 'fill-gave-up';
        return GAVE_UP_MS;
    }

    /** Counts the search's last move, and returns how long it holds the screen. The moves speed up as a search goes on. */
    function reportSearchMove(firstMoveMs: number): number {
        lastSearchCell = solver.lastCell;
        lastSearchDigit = solver.lastDigit;
        if (solver.lastMove === 'try') {
            searchTries++;
            stepKind = 'search-tried';
        }
        else {
            searchRetreats++;
            stepKind = 'search-retreated';
        }
        return Math.max(FASTEST_MOVE_MS, firstMoveMs * Math.pow(MOVE_SPEED_UP, solver.steps - 1));
    }

    // --- Digging ---

    function chooseCellToDig(): number {
        phase = 'digging';
        isShowingSearch = false;
        testDigit = 0;
        testedCell = -1;
        rivalDigits = 0;
        ruledOutDigits = 0;
        if (givensCount <= givensTarget || digIndex === CELL_COUNT) {
            focusCell = -1;
            stage = 'shuffle';
            stepKind = givensCount <= givensTarget ? 'dig-enough' : 'dig-done';
            return DIG_ENDED_MS;
        }
        focusCell = digOrder[digIndex++];
        originalDigit = puzzle[focusCell];
        stage = 'dig-check';
        stepKind = 'dig-chosen';
        return DIG_CHOSEN_MS;
    }

    function checkCellToDig(): number {
        const fewest = LEVEL_SETTINGS[level].fewestPerLine;
        if (rowGivens[ROW_OF[focusCell]] <= fewest || columnGivens[COLUMN_OF[focusCell]] <= fewest) {
            marks[focusCell] = HELD;
            cellsHeld++;
            stage = 'dig-choose';
            stepKind = 'dig-held';
            return DIG_HELD_MS;
        }
        // Empty the cell, and see which other digits could go there
        puzzle[focusCell] = 0;
        digitsToTest = findCandidates(puzzle, focusCell) & ~toDigitSet(originalDigit);
        testedCell = focusCell;
        rivalDigits = digitsToTest;
        if (digitsToTest === 0) {
            digOut();
            stepKind = 'dig-only-digit';
            return DIG_DUG_MS;
        }
        return startNextTest();
    }

    /** Puts the next digit to test into the cell being dug, and starts a search from there. */
    function startNextTest(): number {
        testDigit = lowestDigit(digitsToTest);
        digitsToTest &= ~toDigitSet(testDigit);
        puzzle[focusCell] = testDigit;
        solver.start(puzzle, 'lowest-first');
        puzzle[focusCell] = 0;
        testsRun++;
        isShowingSearch = true;
        stage = 'dig-test';
        stepKind = 'dig-testing';
        return DIG_TESTING_MS;
    }

    function runTest(): number {
        if (solver.status === 'searching') {
            solver.step();
            if (solver.lastMove !== 'none') return reportSearchMove(TEST_MOVE_MS);
        }
        if (solver.status === 'solved') {
            // A second solution: the cell must keep its digit. The search's solution stays on show while the step holds
            puzzle[focusCell] = originalDigit;
            marks[focusCell] = NEEDED;
            lastNeededCell = focusCell;
            cellsNeeded++;
            stage = 'dig-choose';
            stepKind = 'dig-needed';
            return DIG_NEEDED_MS;
        }
        isShowingSearch = false;
        ruledOutDigits |= toDigitSet(testDigit);
        testsFailed++;
        if (digitsToTest === 0) {
            digOut();
            stepKind = 'dig-dug';
            return DIG_DUG_MS;
        }
        stage = 'dig-next-test';
        stepKind = 'dig-test-failed';
        return DIG_TEST_FAILED_MS;
    }

    /** Leaves the cell being dug empty for good. */
    function digOut(): void {
        isShowingSearch = false;
        marks[focusCell] = DUG;
        lastDugCell = focusCell;
        lastDugDigit = originalDigit;
        cellsDug++;
        countGivens();
        stage = 'dig-choose';
    }

    // --- Shuffling ---

    function shuffleOnce(): number {
        phase = 'shuffling';
        if (shufflesDone === SHUFFLE_COUNT) {
            stage = 'mark';
            return -1;
        }
        shuffleKind = SHUFFLE_KINDS[shufflesDone % SHUFFLE_KINDS.length];
        switch (shuffleKind) {
            case 'digits':
                pickTwo(9);
                shuffleFirst++;
                shuffleSecond++;
                swapDigits(solution, shuffleFirst, shuffleSecond);
                swapDigits(puzzle, shuffleFirst, shuffleSecond);
                break;
            case 'columns': {
                const stack = Math.floor(random.next() * 3);
                pickTwo(3);
                shuffleFirst += stack * 3;
                shuffleSecond += stack * 3;
                swapColumns(solution, shuffleFirst, shuffleSecond);
                swapColumns(puzzle, shuffleFirst, shuffleSecond);
                swapColumns(marks, shuffleFirst, shuffleSecond);
                break;
            }
            case 'stacks':
                pickTwo(3);
                swapStacks(solution, shuffleFirst, shuffleSecond);
                swapStacks(puzzle, shuffleFirst, shuffleSecond);
                swapStacks(marks, shuffleFirst, shuffleSecond);
                break;
            case 'turn':
                turnGrid(solution, scratch);
                turnGrid(puzzle, scratch);
                turnGrid(marks, scratch);
                break;
        }
        shufflesDone++;
        countGivens();
        stepKind = 'shuffled';
        return SHUFFLE_MS;
    }

    /** Sets `shuffleFirst` and `shuffleSecond` to two different whole numbers below `count`, the smaller first. */
    function pickTwo(count: number): void {
        const a = Math.floor(random.next() * count);
        const b = (a + 1 + Math.floor(random.next() * (count - 1))) % count;
        shuffleFirst = Math.min(a, b);
        shuffleSecond = Math.max(a, b);
    }

    // --- Grading ---

    function markCandidates(): number {
        phase = 'grading';
        grader.start(puzzle);
        stage = 'grade';
        stepKind = 'grade-marked';
        return MARKED_MS;
    }

    function gradeOneStep(): number {
        if (grader.status === 'solved') {
            stage = 'finish';
            return -1;
        }
        grader.step();
        if (grader.status === 'stuck') {
            needsGuessing = true;
            solver.start(grader.digits, 'lowest-first');
            isShowingSearch = true;
            stage = 'guess';
            stepKind = 'grade-stuck';
            return STUCK_MS;
        }
        stepKind = 'grade-step';
        // The grader always has a technique after a step that wasn't stuck
        return TECHNIQUE_MS[grader.lastTechnique ?? 'naked-single'];
    }

    function finishByGuessing(): number {
        if (solver.status === 'searching') {
            solver.step();
            if (solver.lastMove !== 'none') return reportSearchMove(TEST_MOVE_MS);
        }
        stage = 'finish';
        return -1;
    }

    function finishPuzzle(): number {
        phase = 'finished';
        isShowingSearch = false;
        grade = findGrade();
        puzzlesFinished++;
        stage = 'next';
        stepKind = 'finished';
        return FINISHED_MS;
    }

    /** The level the graded puzzle came out at: Evil if it needs guesswork, otherwise the level of its hardest technique. */
    function findGrade(): Level {
        if (needsGuessing) return 'evil';
        return grader.hardest === undefined ? 'easiest' : TECHNIQUE_LEVEL[grader.hardest];
    }

    function startNextPuzzle(): number {
        startPuzzle(LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length]);
        return -1;
    }

    // --- Keeping the counts and the cells up to date ---

    function isGrading(): boolean {
        return phase === 'grading';
    }

    function countGivens(): void {
        rowGivens.fill(0);
        columnGivens.fill(0);
        givensCount = 0;
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (puzzle[cell] === 0) continue;
            givensCount++;
            rowGivens[ROW_OF[cell]]++;
            columnGivens[COLUMN_OF[cell]]++;
        }
    }

    function showCells(): void {
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            let digit: number;
            let kind: number;
            if (phase === 'seeding') {
                digit = seeds[cell];
                kind = digit === 0 ? EMPTY : GIVEN;
            }
            else if (isShowingSearch) {
                digit = solver.digits[cell];
                kind = digit === 0 ? EMPTY : findSearchCellKind(cell);
            }
            else if (phase === 'grading') {
                digit = grader.digits[cell];
                kind = digit === 0 ? EMPTY : puzzle[cell] !== 0 ? GIVEN : LOGIC;
            }
            else {
                digit = puzzle[cell];
                kind = digit === 0 ? EMPTY : GIVEN;
            }
            shownDigits[cell] = digit;
            shownKinds[cell] = kind;
        }
    }

    /** Where the digit in `cell` came from, while the search's grid is on show. */
    function findSearchCellKind(cell: number): number {
        if (phase === 'digging' && cell === focusCell) return TEST;
        // A guess finishes from the grader's grid, which holds its own digits as well as the puzzle's
        if (phase === 'grading' && puzzle[cell] === 0 && grader.digits[cell] !== 0) return LOGIC;
        return solver.isGivenAt(cell) ? GIVEN : SEARCH;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The stages of making a puzzle, finer than its phases: each stage takes one kind of step. */
type Stage =
    | 'try' | 'replay'
    | 'seed' | 'fill'
    | 'dig-choose' | 'dig-check' | 'dig-next-test' | 'dig-test'
    | 'shuffle'
    | 'mark' | 'grade' | 'guess'
    | 'finish' | 'next';

/** The most steps one update may take. A search at four times the speed takes about 160 in a frame. */
const MAX_STEPS_PER_UPDATE = 10_000;

const SHUFFLE_KINDS: readonly ShuffleKind[] = ['digits', 'columns', 'stacks', 'turn'];

// Each cell's kind and mark, as small numbers in typed arrays
const EMPTY = 0;
const GIVEN = 1;
const SEARCH = 2;
const TEST = 3;
const LOGIC = 4;
const CELL_KINDS: readonly CellKind[] = ['empty', 'given', 'search', 'test', 'logic'];
const DUG = 1;
const NEEDED = 2;
const HELD = 3;
const DIG_MARKS: readonly DigMark[] = ['none', 'dug', 'needed', 'held'];
