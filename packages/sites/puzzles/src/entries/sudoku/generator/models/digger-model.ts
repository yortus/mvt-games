import { CELL_COUNT, type Level, LEVELS } from '../sudoku-grid';
import { type CellDigging, createCellDigger, type DigMark } from './cell-digger';
import { type CellEvent } from './cell-event';
import { createGridFiller, type GridFilling } from './grid-filler';
import { createGridShuffler, type GridShuffling } from './grid-shuffler';
import { createLogicGrader, type Technique } from './logic-grader';
import {
    FASTEST_MOVE_MS, FILL_MOVE_MS, GRID_CHOSEN_MS, GRID_TRIED_MS, MAX_GRIDS_TRIED, MOVE_SPEED_UP, PLAYBACK_RATE, STEP_MS,
    TECHNIQUE_LEVEL, TECHNIQUE_MS, TEST_MOVE_MS,
} from './model-constants';
import { createRandom } from './random';
import { createSearchLog, type SearchMoves } from './search-log';
import type { StepKind } from './step-kind';
import { createStepSolver } from './step-solver';

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
 * The model is built from a child for each stage of the making: a grid
 * filler, which seeds a grid and fills it, a cell digger, a shuffler, and
 * the logic grader. Each takes one step at a time and says what it did. The
 * model chooses which stage runs, and how long each step holds the screen.
 *
 * The model is built from a child for each stage of the making: a grid
 * filler, which seeds a grid and fills it, a cell digger, a shuffler, and
 * the logic grader. Each takes one step at a time and says what it did. The
 * model chooses which stage runs, and how long each step holds the screen.
 *
 * Cells are numbered across each row from the top left, 0 to 80. Digits are
 * 1 to 9, and 0 is an empty cell. A set of digits is a mask with bit `d` set
 * for each digit `d` in it.
 */
export interface DiggerModel {
    /** The level the current puzzle is being dug for. */
    readonly level: Level;
    readonly phase: DiggerPhase;
    readonly playback: Playback;
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

    // What each stage has done for this puzzle so far. Each count rises at a moment worth a sound
    readonly trying: PuzzleTries;
    readonly filling: GridFilling;
    /** The search's moves, while it fills the grid, tests a cell being dug, or finishes a puzzle by guesswork. */
    readonly search: SearchMoves;
    readonly digging: CellDigging;
    readonly shuffling: GridShuffling;
    readonly grading: PuzzleGrading;

    /** The level the puzzle came out at, once it is graded. */
    readonly grade: Level | undefined;
    /** Puzzles finished since the model was made. */
    readonly puzzlesFinished: number;

    /** Runs the making at this speed from the next update. */
    choosePlayback: (playback: Playback) => void;
    /** Starts a new puzzle, for `level`, at the next update. */
    chooseLevel: (level: Level) => void;
    /** Starts a new puzzle for the current level, at the next update. */
    makeNewPuzzle: () => void;
    /** Takes one more step at the next update, whatever the playback. For stepping while paused. */
    step: () => void;
    /**
     * Makes the rest of the puzzle at the next update, all at once and out of
     * sight, and stops at its finish. For a puzzle made to be played rather
     * than watched.
     */
    finishNow: () => void;
    update: (deltaMs: number) => void;
}

/** The puzzles tried out of sight for this one. */
export interface PuzzleTries {
    /** Puzzles tried so far, the one chosen among them. */
    readonly gridsTried: number;
    /**
     * Whether a puzzle has been chosen from those tried: the first to come out
     * at the level asked for, or, if none did before the tries ran out, the
     * one that came nearest.
     */
    readonly isGridChosen: boolean;
    /** The level the last puzzle tried came out at, or the chosen one's once it is chosen. */
    readonly triedGrade: Level | undefined;
}

/** Grading the shuffled puzzle, by solving it as a person would. */
export interface PuzzleGrading {
    /** The digits the grader's steps placed, each at its cell. */
    readonly placements: CellEvent;
    /** The grader's steps that only rubbed out pencil marks. */
    readonly reductions: number;
    /** The technique of the grader's last step, while it shows, or undefined. */
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
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DiggerModelOptions {
    /** Any whole number. The same seed makes the same puzzles. */
    readonly seed: number;
    /** The level of the first puzzle. Each puzzle after it is a level harder, and Hardest is followed by Easiest. Defaults to Easy. */
    readonly level?: Level;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a model that starts making its first puzzle at its first update. */
export function createDiggerModel(options: DiggerModelOptions): DiggerModel {
    const random = createRandom({ seed: options.seed });
    const solver = createStepSolver({ random });
    const search = createSearchLog();
    const grader = createLogicGrader();

    // The grid as it is made, which the stages share: the full grid, the puzzle dug from it, and each cell's dig mark
    const solution = new Uint8Array(CELL_COUNT);
    const puzzle = new Uint8Array(CELL_COUNT);
    const marks = new Uint8Array(CELL_COUNT);
    const filler = createGridFiller({ random, solver, search });
    const digger = createCellDigger({ random, solver, search, solution, puzzle, marks });
    const shuffler = createGridShuffler({ random, solution, puzzle, marks });
    // What each cell shows, brought up to date after every step
    const shownDigits = new Uint8Array(CELL_COUNT);
    const shownKinds = new Uint8Array(CELL_COUNT);

    let level: Level = options.level ?? 'easy';
    let phase: DiggerPhase = 'seeding';
    let stage: Stage = 'try';
    let playback: Playback = 'normal';
    let stepKind: StepKind = 'started';
    let stepCount = 0;
    let holdMs = 0;
    let holdTotalMs = 0;
    let pendingLevel: Level | undefined = level;
    let pendingSteps = 0;
    let isFinishPending = false;
    let isShowingSearch = false;
    let needsGuessing = false;
    let grade: Level | undefined;
    let puzzlesFinished = 0;

    // The puzzles tried out of sight, and the random numbers' state as the nearest to the level asked for began
    let gridsTried = 0;
    let isGridChosen = false;
    let triedGrade: Level | undefined;
    let nearestDistance = Infinity;
    let nearestGrade: Level | undefined;
    let nearestRandomState = 0;

    const trying: PuzzleTries = {
        get gridsTried() { return gridsTried; },
        get isGridChosen() { return isGridChosen; },
        get triedGrade() { return triedGrade; },
    };
    const grading: PuzzleGrading = {
        placements: {
            get count() { return grader.placements; },
            get cell() { return grader.lastCell; },
            get digit() { return grader.lastDigit; },
        },
        get reductions() { return grader.reductions; },
        get technique() { return isGrading() && stepKind === 'grade-step' ? grader.lastTechnique : undefined; },
        get techniqueUnit() { return grader.lastUnit; },
        get techniqueCell() { return grader.lastCell; },
        get techniqueDigit() { return grader.lastDigit; },
        get hardestTechnique() { return grader.hardest; },
        get needsGuessing() { return needsGuessing; },
    };

    const model: DiggerModel = {
        get level() { return level; },
        get phase() { return phase; },
        get playback() { return playback; },
        get stepKind() { return stepKind; },
        get stepCount() { return stepCount; },
        get stepProgress() { return holdTotalMs > 0 ? 1 - holdMs / holdTotalMs : 1; },

        digitAt: (cell) => shownDigits[cell],
        cellKindAt: (cell) => CELL_KINDS[shownKinds[cell]],
        digMarkAt: digger.digMarkAt,
        candidatesAt: (cell) => (isGrading() && shownDigits[cell] === 0 ? grader.candidates[cell] : 0),
        eliminatedAt: (cell) => (isGrading() && stepKind === 'grade-step' ? grader.eliminated[cell] : 0),
        isHighlightedAt: (cell) => isGrading() && stepKind === 'grade-step' && grader.isHighlightedAt(cell),
        isDifferentAt: (cell) => stepKind === 'dig-needed' && isShowingSearch && solver.digits[cell] !== solution[cell],
        fullGridDigitAt: (cell) => solution[cell],

        trying,
        filling: filler,
        search,
        digging: digger,
        shuffling: shuffler,
        grading,
        get grade() { return grade; },
        get puzzlesFinished() { return puzzlesFinished; },

        choosePlayback(next) { playback = next; },
        chooseLevel(next) { pendingLevel = next; },
        makeNewPuzzle() { pendingLevel = level; },
        step() { pendingSteps++; },
        finishNow() { isFinishPending = true; },
        update,
    };
    return model;

    function update(deltaMs: number): void {
        if (pendingLevel !== undefined) {
            startPuzzle(pendingLevel);
            pendingLevel = undefined;
        }
        if (isFinishPending) {
            isFinishPending = false;
            finishAtOnce();
            return;
        }
        for (; pendingSteps > 0; pendingSteps--) takeStep();
        let msToRun = deltaMs * PLAYBACK_RATE[playback];
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
        solution.fill(0);
        filler.reset();
        digger.reset(level);
        shuffler.reset();
        grade = undefined;
        clearCounts();
    }

    /** Sets this puzzle's counts back to nothing, and leaves nothing being dug, searched or graded. */
    function clearCounts(): void {
        filler.clearCounts();
        search.reset();
        digger.clearCounts();
        shuffler.clearCounts();
        // The grader's counts go with its puzzle, so it is given the puzzle afresh
        grader.start(puzzle);
        isShowingSearch = false;
        needsGuessing = false;
    }

    /** Runs every stage left to the puzzle's finish, showing none of them, then takes the finish as a step of its own. */
    function finishAtOnce(): void {
        pendingSteps = 0;
        // Once finished, the next stage starts another puzzle
        if (stage === 'next') return;
        while (!isReadyToFinish()) runStage();
        takeStep();
    }

    /** Takes the next step, and holds it on screen for as long as it deserves. */
    function takeStep(): void {
        let kind = runStage();
        // A stage with nothing to show hands on to the next one, in the same step
        while (kind === undefined) kind = runStage();
        stepKind = kind;
        holdMs = findHoldMs(kind);
        holdTotalMs = holdMs;
        stepCount++;
        showCells();
    }

    /** Runs the current stage once, and says what its step did, or undefined if it showed nothing. */
    function runStage(): StepKind | undefined {
        switch (stage) {
            case 'try': return tryGrid();
            case 'replay': return replayChosenGrid();
            case 'fill': return fillGrid();
            case 'dig': return digCell();
            case 'shuffle': return shuffleOnce();
            case 'mark': return markCandidates();
            case 'grade': return gradeOneStep();
            case 'guess': return finishByGuessing();
            case 'finish': return finishPuzzle();
            case 'next': return startNextPuzzle();
        }
    }

    /** How long a step of `kind`, just taken, holds the screen at normal speed. */
    function findHoldMs(kind: StepKind): number {
        switch (kind) {
            case 'started': return 0;
            case 'grid-tried': return isGridChosen ? GRID_CHOSEN_MS : GRID_TRIED_MS;
            case 'search-tried':
            case 'search-retreated': {
                // The moves speed up as a search goes on
                const firstMoveMs = phase === 'filling' ? FILL_MOVE_MS : TEST_MOVE_MS;
                return Math.max(FASTEST_MOVE_MS, firstMoveMs * Math.pow(MOVE_SPEED_UP, solver.steps - 1));
            }
            // The grader always has a technique after a step that wasn't stuck
            case 'grade-step': return TECHNIQUE_MS[grader.lastTechnique ?? 'naked-single'];
            default: return STEP_MS[kind];
        }
    }

    // --- Trying puzzles out of sight ---

    /** Makes and grades a whole puzzle in one step, and chooses it if it came out at the level asked for. */
    function tryGrid(): StepKind {
        resetRun();
        const randomState = random.state;
        stage = 'fill';
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
        clearCounts();
        phase = 'trying';
        stage = isGridChosen ? 'replay' : 'try';
        return 'grid-tried';
    }

    /** Whether the puzzle is made and graded, and only its finish is left. */
    function isReadyToFinish(): boolean {
        return stage === 'finish';
    }

    /** Winds the random numbers back to where the chosen puzzle began, to make it again in sight. */
    function replayChosenGrid(): undefined {
        random.state = nearestRandomState;
        resetRun();
        stage = 'fill';
        return undefined;
    }

    // --- The stages the children run ---

    function fillGrid(): StepKind {
        const kind = filler.step();
        phase = filler.phase;
        isShowingSearch = filler.isShowingSearch;
        if (filler.isFull) {
            solution.set(solver.digits);
            digger.start();
            stage = 'dig';
        }
        return kind;
    }

    function digCell(): StepKind {
        phase = 'digging';
        const kind = digger.step();
        isShowingSearch = digger.isShowingSearch;
        if (digger.isDone) stage = 'shuffle';
        return kind;
    }

    function shuffleOnce(): StepKind | undefined {
        phase = 'shuffling';
        if (shuffler.isDone) {
            stage = 'mark';
            return undefined;
        }
        const kind = shuffler.step();
        digger.countGivens();
        return kind;
    }

    // --- Grading ---

    function markCandidates(): StepKind {
        phase = 'grading';
        grader.start(puzzle);
        stage = 'grade';
        return 'grade-marked';
    }

    function gradeOneStep(): StepKind | undefined {
        if (grader.status === 'solved') {
            stage = 'finish';
            return undefined;
        }
        grader.step();
        if (grader.status === 'stuck') {
            needsGuessing = true;
            solver.start(grader.digits, 'lowest-first');
            isShowingSearch = true;
            stage = 'guess';
            return 'grade-stuck';
        }
        return 'grade-step';
    }

    function finishByGuessing(): StepKind | undefined {
        if (solver.status === 'searching') {
            solver.step();
            const move = search.recordMove(solver);
            if (move !== undefined) return move;
        }
        stage = 'finish';
        return undefined;
    }

    function finishPuzzle(): StepKind {
        phase = 'finished';
        isShowingSearch = false;
        grade = findGrade();
        puzzlesFinished++;
        stage = 'next';
        return 'finished';
    }

    /** The level the graded puzzle came out at: Hardest if it needs guesswork, otherwise the level of its hardest technique. */
    function findGrade(): Level {
        if (needsGuessing) return 'hardest';
        return grader.hardest === undefined ? 'easiest' : TECHNIQUE_LEVEL[grader.hardest];
    }

    function startNextPuzzle(): undefined {
        startPuzzle(LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length]);
        return undefined;
    }

    // --- Keeping the cells up to date ---

    function isGrading(): boolean {
        return phase === 'grading';
    }

    function showCells(): void {
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            let digit: number;
            let kind: number;
            if (phase === 'seeding') {
                digit = filler.seedDigits[cell];
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
        if (phase === 'digging' && cell === digger.focusCell) return TEST;
        // A guess finishes from the grader's grid, which holds its own digits as well as the puzzle's
        if (phase === 'grading' && puzzle[cell] === 0 && grader.digits[cell] !== 0) return LOGIC;
        return solver.isGivenAt(cell) ? GIVEN : SEARCH;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The stages of making a puzzle, finer than its phases: each runs one kind of step, most of them through a child. */
type Stage = 'try' | 'replay' | 'fill' | 'dig' | 'shuffle' | 'mark' | 'grade' | 'guess' | 'finish' | 'next';

/** The most steps one update may take. A search at four times the speed takes about 160 in a frame. */
const MAX_STEPS_PER_UPDATE = 10_000;

// Each cell's kind, as a small number in a typed array
const EMPTY = 0;
const GIVEN = 1;
const SEARCH = 2;
const TEST = 3;
const LOGIC = 4;
const CELL_KINDS: readonly CellKind[] = ['empty', 'given', 'search', 'test', 'logic'];
