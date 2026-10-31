import { createSequence, type Sequence, type StepDef, watch } from '@mvtjs/utils';
import { easeInOut } from '#sudoku-digger';
import type { TutorialDemoKind } from '../models';
import { findCellMiddleX, findCellMiddleY, findKeyMiddleX, KEY_MIDDLE_Y } from './puzzle-layout';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './view-constants';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The show the tutorial's arrow puts on, over and over, for the demo: it
 * comes in, taps, drags or double-taps on the grid or the keypad, lingers,
 * and goes. Each kind of show is a sequence of timed steps, made once, so
 * its timings read as a table. A touch's ripple is a step of its own,
 * which runs alongside the steps after the touch. The places the arrow goes
 * are found as the demo changes. The pose is in the screen's pixels.
 */
export interface TutorialPointerViewModel {
    /** Where the arrow's tip is, and how clearly it shows, from 0 to 1. */
    readonly x: number;
    readonly y: number;
    readonly alpha: number;
    /** Whether the arrow is touching the screen. */
    readonly isDown: boolean;
    /** Where the arrow last touched down, which its ripple spreads from, and a drag trails from. */
    readonly touchX: number;
    readonly touchY: number;
    /** How far the last touch's ripple has spread, from 0 to 1, or 1 once it is gone. */
    readonly rippleProgress: number;
    /** Moves the show on by `deltaMs`, starting it over as the demo changes, and as it ends. */
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TutorialPointerViewModelOptions {
    /** What the arrow shows how to do, on which cells, with which digits. */
    readonly demo: () => TutorialDemoKind;
    readonly demoCells: () => readonly number[];
    readonly demoDigits: () => readonly number[];
    /** A count that rises each time the demo changes, which starts the show over. */
    readonly demosShown: () => number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates the show for the demo as it is now, from its start. */
export function createTutorialPointerViewModel(options: TutorialPointerViewModelOptions): TutorialPointerViewModel {
    const shows: Readonly<Record<ShowKind, Show>> = {
        select: createShow(SELECT_LEGS),
        fill: createShow(FILL_LEGS),
        noteOne: createShow(NOTE_ONE_LEGS),
        noteTwo: createShow(NOTE_TWO_LEGS),
        link: createShow(LINK_LEGS),
    };
    // The show running, if any, and the places it goes: the first and second points, and away from each, off to one side
    let show: Show | undefined;
    const places: Record<Place, { x: number; y: number }> = {
        awayFromFirst: { x: 0, y: 0 }, first: { x: 0, y: 0 }, second: { x: 0, y: 0 }, awayFromLast: { x: 0, y: 0 },
    };
    const watcher = watch({ shown: options.demosShown });
    const pose = { x: 0, y: 0, alpha: 0, isDown: false, touchX: 0, touchY: 0, rippleProgress: 1 };
    chooseShow();

    return {
        get x() { return pose.x; },
        get y() { return pose.y; },
        get alpha() { return pose.alpha; },
        get isDown() { return pose.isDown; },
        get touchX() { return pose.touchX; },
        get touchY() { return pose.touchY; },
        get rippleProgress() { return pose.rippleProgress; },
        update(deltaMs) {
            if (watcher.poll().shown.changed) chooseShow();
            if (show === undefined) return;
            if (!show.sequence.isActive) show.sequence.start();
            show.sequence.update(deltaMs);
            posePointer(show);
        },
    };

    /** Chooses the show for the demo as it is now, finds the places it goes, and starts it. */
    function chooseShow(): void {
        const cells = options.demoCells();
        const digits = options.demoDigits();
        show = undefined;
        pose.alpha = 0;
        pose.rippleProgress = 1;
        switch (options.demo()) {
            case 'select':
                if (cells.length === 0) return;
                setPlaces(findCellMiddleX(cells[0]), findCellMiddleY(cells[0]), 0, 0, false);
                show = shows.select;
                break;
            case 'fill':
                if (cells.length === 0 || digits.length === 0) return;
                setPlaces(findCellMiddleX(cells[0]), findCellMiddleY(cells[0]), findKeyMiddleX(digits[0]), KEY_MIDDLE_Y, true);
                show = shows.fill;
                break;
            case 'note':
                if (digits.length === 0) return;
                setPlaces(findKeyMiddleX(digits[0]), KEY_MIDDLE_Y, findKeyMiddleX(digits[digits.length - 1]), KEY_MIDDLE_Y, digits.length > 1);
                show = digits.length > 1 ? shows.noteTwo : shows.noteOne;
                break;
            case 'link': {
                if (cells.length < 2) return;
                const last = cells[cells.length - 1];
                setPlaces(findCellMiddleX(cells[0]), findCellMiddleY(cells[0]), findCellMiddleX(last), findCellMiddleY(last), true);
                show = shows.link;
                break;
            }
            case 'none':
                return;
        }
        show.sequence.start();
    }

    /** Sets the show's places: its first point, its second if `hasSecond`, and the places it comes from and goes to. */
    function setPlaces(firstX: number, firstY: number, secondX: number, secondY: number, hasSecond: boolean): void {
        places.first.x = firstX;
        places.first.y = firstY;
        places.second.x = hasSecond ? secondX : firstX;
        places.second.y = hasSecond ? secondY : firstY;
        places.awayFromFirst.x = findAwayX(firstX);
        places.awayFromFirst.y = findAwayY(firstY);
        places.awayFromLast.x = findAwayX(places.second.x);
        places.awayFromLast.y = findAwayY(places.second.y);
    }

    /** Works out the pose from how far through its steps the show is. */
    function posePointer(running: Show): void {
        const { legs, steps, ripples } = running;
        let fromX = places.awayFromFirst.x;
        let fromY = places.awayFromFirst.y;
        let fromAlpha = 0;
        pose.x = fromX;
        pose.y = fromY;
        pose.alpha = 0;
        pose.isDown = false;
        pose.rippleProgress = 1;
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];
            const step = steps[i];
            if (!step.isActive && step.progress <= 0) break;
            const to = places[leg.to];
            const t = easeInOut(step.progress);
            pose.x = fromX + (to.x - fromX) * t;
            pose.y = fromY + (to.y - fromY) * t;
            pose.alpha = fromAlpha + (leg.alpha - fromAlpha) * t;
            pose.isDown = leg.isDown;
            const ripple = ripples[i];
            if (ripple !== undefined) {
                // A touch ripples from where it went down, which a drag that follows trails from
                pose.touchX = fromX;
                pose.touchY = fromY;
                pose.rippleProgress = ripple.isActive ? ripple.progress : 1;
            }
            fromX = to.x;
            fromY = to.y;
            fromAlpha = leg.alpha;
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The kinds of show: one for each demo, and two for noting, as it notes one digit or two. */
type ShowKind = 'select' | 'fill' | 'noteOne' | 'noteTwo' | 'link';

/** The places a show goes: in to its first point, on to its second, if it has one, and away from the last. */
type Place = 'awayFromFirst' | 'first' | 'second' | 'awayFromLast';

/**
 * A leg of a show: a step, which moves the arrow to a place over its time,
 * touching the screen or not, and fading to an alpha on the way. A leg that
 * touches down sends out a ripple.
 */
interface Leg {
    readonly name: string;
    readonly ms: number;
    readonly to: Place;
    readonly isDown: boolean;
    readonly alpha: number;
    readonly ripples?: boolean;
}

/** A show: its legs, in order, and the sequence that times them, with each leg's step, and the ripple alongside each touch. */
interface Show {
    readonly legs: readonly Leg[];
    readonly sequence: Sequence;
    readonly steps: readonly StepState[];
    readonly ripples: readonly (StepState | undefined)[];
}

/** How far through a step of a sequence is. */
type StepState = Sequence['steps'][string];

const COME_MS = 600;
const TAP_DOWN_MS = 150;
const TAP_UP_MS = 300;
const QUICK_TAP_MS = 110;
const MOVE_MS = 380;
const DRAG_MS = 800;
const LINGER_MS = 500;
const GO_MS = 450;
/** How long the screen is left clear before the show starts over. */
const PAUSE_MS = 700;
const RIPPLE_MS = 450;
/** Where the arrow waits, out of the way, before it comes in and after it goes: this far from its first and last points. */
const AWAY_X = 80;
const AWAY_Y = 110;

// Each show's legs. Each comes in to its first point, and ends lingering at its last, then going, then a pause
const COME: Leg = { name: 'come', ms: COME_MS, to: 'first', isDown: false, alpha: 1 };

function writeEnding(last: Place): readonly Leg[] {
    return [
        { name: 'linger', ms: LINGER_MS, to: last, isDown: false, alpha: 1 },
        { name: 'go', ms: GO_MS, to: 'awayFromLast', isDown: false, alpha: 0 },
        { name: 'pause', ms: PAUSE_MS, to: 'awayFromLast', isDown: false, alpha: 0 },
    ];
}

/** Selecting a cell: a tap on it. */
const SELECT_LEGS: readonly Leg[] = [
    COME,
    { name: 'press', ms: TAP_DOWN_MS, to: 'first', isDown: true, alpha: 1, ripples: true },
    { name: 'lift', ms: TAP_UP_MS, to: 'first', isDown: false, alpha: 1 },
    ...writeEnding('first'),
];

/** Filling a cell in: a tap on the cell, then a double tap on its digit's key. */
const FILL_LEGS: readonly Leg[] = [
    COME,
    { name: 'press', ms: TAP_DOWN_MS, to: 'first', isDown: true, alpha: 1, ripples: true },
    { name: 'lift', ms: TAP_UP_MS, to: 'first', isDown: false, alpha: 1 },
    { name: 'to-key', ms: MOVE_MS * 2, to: 'second', isDown: false, alpha: 1 },
    { name: 'press-key', ms: QUICK_TAP_MS, to: 'second', isDown: true, alpha: 1, ripples: true },
    { name: 'lift-key', ms: QUICK_TAP_MS, to: 'second', isDown: false, alpha: 1 },
    { name: 'press-key-again', ms: QUICK_TAP_MS, to: 'second', isDown: true, alpha: 1, ripples: true },
    { name: 'lift-key-again', ms: TAP_UP_MS, to: 'second', isDown: false, alpha: 1 },
    ...writeEnding('second'),
];

/** Noting one digit: a tap on its key. */
const NOTE_ONE_LEGS: readonly Leg[] = SELECT_LEGS;

/** Noting two digits: a tap on each one's key. */
const NOTE_TWO_LEGS: readonly Leg[] = [
    COME,
    { name: 'press', ms: TAP_DOWN_MS, to: 'first', isDown: true, alpha: 1, ripples: true },
    { name: 'lift', ms: TAP_UP_MS, to: 'first', isDown: false, alpha: 1 },
    { name: 'to-second', ms: MOVE_MS, to: 'second', isDown: false, alpha: 1 },
    { name: 'press-second', ms: TAP_DOWN_MS, to: 'second', isDown: true, alpha: 1, ripples: true },
    { name: 'lift-second', ms: TAP_UP_MS, to: 'second', isDown: false, alpha: 1 },
    ...writeEnding('second'),
];

/** Linking two cells: a press on the first, a drag to the second, and a lift. */
const LINK_LEGS: readonly Leg[] = [
    COME,
    { name: 'press', ms: TAP_DOWN_MS * 2, to: 'first', isDown: true, alpha: 1, ripples: true },
    { name: 'drag', ms: DRAG_MS, to: 'second', isDown: true, alpha: 1 },
    { name: 'hold', ms: TAP_DOWN_MS, to: 'second', isDown: true, alpha: 1 },
    { name: 'lift', ms: TAP_UP_MS, to: 'second', isDown: false, alpha: 1 },
    ...writeEnding('second'),
];

/** Makes the sequence that times `legs`, one after another, with a ripple starting alongside each touch. */
function createShow(legs: readonly Leg[]): Show {
    const steps: StepDef[] = [];
    let startMs = 0;
    for (let i = 0; i < legs.length; i++) {
        const { name, ms, ripples } = legs[i];
        steps.push({ name, startMs, durationMs: ms });
        if (ripples === true) steps.push({ name: toRippleName(name), startMs, durationMs: RIPPLE_MS });
        startMs += ms;
    }
    const sequence = createSequence(steps);
    return {
        legs,
        sequence,
        steps: legs.map((leg) => sequence.steps[leg.name]),
        ripples: legs.map((leg) => (leg.ripples === true ? sequence.steps[toRippleName(leg.name)] : undefined)),
    };
}

function toRippleName(legName: string): string {
    return `${legName}-ripple`;
}

/** Away from `x` to the right, or to the left near the right edge, so the arrow stays on screen. */
function findAwayX(x: number): number {
    return x + AWAY_X < SCREEN_WIDTH ? x + AWAY_X : x - AWAY_X;
}

function findAwayY(y: number): number {
    return Math.min(SCREEN_HEIGHT - 20, y + AWAY_Y);
}
