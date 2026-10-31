import { Container } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';
import { watch } from '@mvtjs/utils';
import type { SfxChip } from '#shared';
import {
    CHOSEN, DEAD_END, DUG, FILLED, FINISHED, GAVE_UP, HELD, MARKED, NEEDED, PLACED, RUBBED_OUT, SEED, SHUFFLE, STUCK, TRIED, TRY,
} from '../data';
import type { CellEvent, DiggerPhase } from '../models';
import { COLUMN_OF } from '../sudoku-grid';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

/**
 * What a `DiggerAudioView` plays on, and the counts it plays the sounds of.
 * Each count rises at a moment worth a sound. A `CellEvent` is a record the
 * model keeps and changes in place, read once: its count, and the cell and
 * digit of the last time, which say where the sound plays, and its note.
 */
export interface DiggerAudioViewBindings {
    /** The chip the sound effects play on. It is the view's output, so the view reads it once. */
    readonly sfx: SfxChip<'audio90'>;
    /** The view chimes as the grid is full, and as the pencil marks go in. */
    readonly phase: () => DiggerPhase;
    readonly seeds: CellEvent;
    /** The search's moves: each try blips, and each retreat at a dead end thumps. */
    readonly tries: CellEvent;
    readonly retreats: CellEvent;
    readonly restarts: () => number;
    readonly dug: CellEvent;
    readonly needed: CellEvent;
    /** Rival digits that led nowhere in the cell being dug. Each is brushed out, unless the cell is dug as it fails. */
    readonly failedTests: CellEvent;
    readonly held: CellEvent;
    readonly shufflesDone: () => number;
    readonly placements: CellEvent;
    readonly logicReductions: () => number;
    readonly needsGuessing: () => boolean;
    readonly puzzlesFinished: () => number;
    /** Puzzles tried out of sight for this one. Each tocks, but the one chosen chimes instead. */
    readonly gridsTried: () => number;
    readonly isGridChosen: () => boolean;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * Plays the demo's sounds, on the Audio90. Each puzzle tried out of sight
 * tocks softly, and the one chosen chimes. A seed rings as it drops in. The
 * search blips as it tries each digit, and thumps at each dead end, at most
 * a few times a second, however fast it runs. A dug cell chimes, a needed
 * cell knocks, a held cell ticks, and each digit tried in a cell being dug
 * that leads nowhere is brushed out. Shuffles breathe, the pencil marks
 * shimmer in, each digit the grader reasons out sounds a wooden note, and
 * each set of marks it rubs out a brush. A stuck grader sounds a low
 * warning, and a finished puzzle a flourish. The tones that follow a digit
 * play at that digit's note on a pentatonic scale, so the search and the
 * grader play little tunes, and each plays where its cell is across the
 * grid.
 *
 * The time since the search's last blip and last thump is the view's
 * presentation state. It advances in the update step, which also decides
 * which of the search's moves are heard. The refresh step plays each sound
 * as its count rises.
 */
export function DiggerAudioView(bindings: DiggerAudioViewBindings): Container {
    const { sfx, seeds, tries, retreats, dug, needed, failedTests, held, placements } = bindings;
    const view = new Container();
    view.label = 'digger-audio';

    // Presentation state: the search's moves to be heard, and when the last of each was
    let msSinceTry = TRY_GAP_MS;
    let msSinceDeadEnd = DEAD_END_GAP_MS;
    let triesHeard = 0;
    let deadEndsHeard = 0;
    let triedCell = 0;
    let triedDigit = 1;
    let deadEndCell = 0;
    const moves = watch({ tries: () => tries.count, retreats: () => retreats.count });

    const watcher = watch({
        phase: bindings.phase,
        seeds: () => seeds.count,
        triesHeard: () => triesHeard,
        deadEndsHeard: () => deadEndsHeard,
        restarts: bindings.restarts,
        dug: () => dug.count,
        needed: () => needed.count,
        failedTests: () => failedTests.count,
        held: () => held.count,
        shuffles: bindings.shufflesDone,
        placements: () => placements.count,
        reductions: bindings.logicReductions,
        needsGuessing: bindings.needsGuessing,
        finished: bindings.puzzlesFinished,
        gridsTried: bindings.gridsTried,
        isGridChosen: bindings.isGridChosen,
    });

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;

    function update(deltaMs: number): void {
        msSinceTry += deltaMs;
        msSinceDeadEnd += deltaMs;
        const m = moves.poll();
        if (m.tries.increased && msSinceTry >= TRY_GAP_MS) {
            msSinceTry = 0;
            triesHeard++;
            triedCell = tries.cell;
            triedDigit = tries.digit;
        }
        if (m.retreats.increased && msSinceDeadEnd >= DEAD_END_GAP_MS) {
            msSinceDeadEnd = 0;
            deadEndsHeard++;
            deadEndCell = retreats.cell;
        }
    }

    function refresh(): void {
        const w = watcher.poll();
        if (w.isGridChosen.changed && w.isGridChosen.current) sfx.play(CHOSEN);
        else if (w.gridsTried.increased) sfx.play(TRIED);
        if (w.seeds.increased) sfx.play(SEED, { note: SEED_ROOT + toPentatonic(seeds.digit), pan: toPan(seeds.cell) });
        if (w.triesHeard.increased) sfx.play(TRY, { note: TRY_ROOT + toPentatonic(triedDigit), pan: toPan(triedCell) });
        if (w.deadEndsHeard.increased) sfx.play(DEAD_END, { pan: toPan(deadEndCell) });
        if (w.restarts.increased) sfx.play(GAVE_UP);
        if (w.phase.changed && w.phase.current === 'digging' && w.phase.previous === 'filling') sfx.play(FILLED);
        if (w.dug.increased) sfx.play(DUG, { note: DUG_ROOT + toPentatonic(dug.digit), pan: toPan(dug.cell) });
        if (w.needed.increased) sfx.play(NEEDED, { pan: toPan(needed.cell) });
        // The last rival to fail digs the cell, whose chime says it all
        if (w.failedTests.increased && !w.dug.increased) sfx.play(RUBBED_OUT, { pan: toPan(failedTests.cell) });
        if (w.held.increased) sfx.play(HELD, { pan: toPan(held.cell) });
        if (w.shuffles.increased) sfx.play(SHUFFLE);
        if (w.phase.changed && w.phase.current === 'grading') sfx.play(MARKED);
        if (w.placements.increased) sfx.play(PLACED, { note: PLACED_ROOT + toPentatonic(placements.digit), pan: toPan(placements.cell) });
        if (w.reductions.increased) sfx.play(RUBBED_OUT);
        if (w.needsGuessing.changed && w.needsGuessing.current) sfx.play(STUCK);
        if (w.finished.increased) sfx.play(FINISHED);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The least time between two of the search's blips, and two of its thumps, in ms. */
const TRY_GAP_MS = 55;
const DEAD_END_GAP_MS = 140;

/** The note each tone plays for the digit 1, as a note number, where 60 is middle C. */
const SEED_ROOT = 72;
const TRY_ROOT = 84;
const DUG_ROOT = 84;
const PLACED_ROOT = 72;

/** Each digit's place on a major pentatonic scale, in semitones up from its root. */
const PENTATONIC: readonly number[] = [0, 0, 2, 4, 7, 9, 12, 14, 16, 19];

function toPentatonic(digit: number): number {
    return PENTATONIC[digit] ?? 0;
}

/** Where a sound at `cell` plays, by its column, from a little left of the middle to a little right. */
function toPan(cell: number): number {
    return cell < 0 ? 0 : (COLUMN_OF[cell] / 8 * 2 - 1) * 0.6;
}
