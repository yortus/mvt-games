import { describe, expect, it } from 'vitest';
import {
    BACKDROP_DELAY_MS, BURN_MS, BURN_STAGGER_MS, FLOAT_DELAY_MS, FLOAT_MS, LAUNCH_MS, POWER_ON_MS, RECEDE_MS, SHOW_STILL_MS,
} from '../data';
import type { ArcadePhase } from '../models';
import {
    createEntryTransitionViewModel, EMERGE_MS, FLOAT_BACK_DELAY_MS, FLOAT_BACK_MS, type PicturePose, POWER_OFF_BEAM_MS, POWER_OFF_MS,
    POWER_ON_BEAM_MS, QUIET_FADE_MS, RETURN_TOTAL_MS, type EntryTransitionViewModel,
} from './entry-transition-view-model';
import type { Rect } from './rect';

/** A card's polaroid: a square window on a picture twice as wide, showing its left half, tilted, in its border. */
const CARD: PicturePose = {
    window: { x: 100, y: 200, width: 50, height: 50 },
    frame: { x: 100, y: 200, width: 100, height: 50 },
    tilt: 3,
    border: 8,
};
const PLAY: Rect = { x: 0, y: 40, width: 500, height: 250 };
const PLAY_CENTRE = { x: 250, y: 165 };
/** The chosen card, one beside it, and one far off. */
const WALL: readonly Rect[] = [
    { x: 90, y: 150, width: 70, height: 110 },
    { x: 170, y: 150, width: 70, height: 110 },
    { x: 900, y: 700, width: 70, height: 110 },
];
/** When the entry's screen begins to power on, and when it has, in the model's `'revealing'`. */
const POWER_ON_AT_MS = RECEDE_MS;
const SHOWING_AT_MS = RECEDE_MS + POWER_ON_MS;

describe('EntryTransitionViewModel', () => {
    describe('going in', () => {
        it('floats the polaroid to the centre of the play area as the other cards burn, straightening it', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            at(harness, 'launching', FLOAT_DELAY_MS);
            expect(pictureOf(harness.transition)).toEqual(CARD);
            at(harness, 'launching', FLOAT_DELAY_MS + FLOAT_MS / 2);
            expect(harness.transition.picture.x).toBeGreaterThan(CARD.window.x);
            expect(harness.transition.picture.tilt).toBeGreaterThan(0);
            expect(harness.transition.picture.tilt).toBeLessThan(CARD.tilt);
            at(harness, 'launching', FLOAT_DELAY_MS + FLOAT_MS);
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
            expect(harness.transition.picture.width).toBe(CARD.window.width);
            expect(harness.transition.picture.border).toBe(CARD.border);
            expect(harness.transition.picture.tilt).toBe(0);
            expect(harness.transition.picture.opacity).toBe(1);
        });

        it('burns the cards nearest the polaroid first, and all of them by the end of the launch', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            expect(harness.transition.wallEffect).toBe('burn');
            at(harness, 'launching', BURN_MS / 2);
            const [chosen, beside, far] = [0, 1, 2].map((i) => harness.transition.cardProgressAt(i));
            expect(chosen).toBeGreaterThan(beside);
            expect(beside).toBeGreaterThan(far);
            at(harness, 'launching', BURN_STAGGER_MS + BURN_MS - 1);
            for (let i = 0; i < 3; i++) expect(harness.transition.cardProgressAt(i)).toBeGreaterThan(0.99);
        });

        it('blacks the page out once the cards have burnt, and draws nothing more over the wall', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            at(harness, 'launching', BACKDROP_DELAY_MS);
            expect(harness.transition.backdropOpacity).toBe(0);
            at(harness, 'launching', LAUNCH_MS);
            expect(harness.transition.backdropOpacity).toBe(1);
            expect(harness.transition.phase).toBe('holding');
            expect(harness.transition.wallEffect).toBe('none');
        });

        it('holds the polaroid while the entry loads after the launch has had its time, and says it is waiting', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            at(harness, 'launching', LAUNCH_MS - 1);
            expect(harness.transition.isWaiting).toBe(false);
            at(harness, 'launching', LAUNCH_MS + 500);
            expect(harness.transition.phase).toBe('holding');
            expect(harness.transition.isWaiting).toBe(true);
            expect(harness.transition.waitedMs).toBe(500);
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
            at(harness, 'revealing', 0);
            expect(harness.transition.phase).toBe('receding');
            expect(harness.transition.isWaiting).toBe(false);
        });

        it('recedes the polaroid over the entry started, then powers the entry on from a white-hot line, then shows it still', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            at(harness, 'launching', LAUNCH_MS - 1);
            at(harness, 'revealing', RECEDE_MS / 2);
            expect(harness.transition.phase).toBe('receding');
            expect(harness.transition.picture.scaleX).toBeLessThan(1);
            expect(harness.transition.picture.opacity).toBeLessThan(1);
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
            // The entry has started, and the page is still black over it
            expect(harness.transition.backdropOpacity).toBe(1);
            expect(harness.transition.stage.isTransformed).toBe(false);
            at(harness, 'revealing', POWER_ON_AT_MS);
            // Gone into the dark: the stage, a line on black, about where the entry plays
            expect(harness.transition.phase).toBe('powering-on');
            expect(harness.transition.picture.opacity).toBe(0);
            expect(harness.transition.playRect).toEqual(PLAY);
            expect(harness.transition.backdropOpacity).toBe(0);
            expect(harness.transition.stage.isTransformed).toBe(true);
            expect(harness.transition.stage.scaleX).toBe(0);
            at(harness, 'revealing', POWER_ON_AT_MS + POWER_ON_MS * 0.2);
            // A white-hot line, growing across
            expect(harness.transition.stage.scaleX).toBeGreaterThan(0);
            expect(harness.transition.stage.scaleY).toBeLessThan(0.05);
            expect(harness.transition.stage.brightness).toBeGreaterThan(1);
            expect(harness.transition.glow.opacity).toBe(1);
            expect(harness.transition.glow.width).toBeGreaterThan(0);
            expect(harness.transition.glow.width).toBeLessThan(PLAY.width);
            expect(harness.transition.glow.height).toBeLessThan(5);
            at(harness, 'revealing', SHOWING_AT_MS);
            // Powered on, the first frame shows still for a moment
            expect(harness.transition.phase).toBe('showing');
            expect(harness.transition.glow.opacity).toBe(0);
            expect(harness.transition.stage.isTransformed).toBe(false);
            expect(harness.transition.stage.scaleY).toBe(1);
            expect(harness.transition.stage.brightness).toBe(1);
            at(harness, 'revealing', SHOWING_AT_MS + SHOW_STILL_MS - 1);
            expect(harness.transition.phase).toBe('showing');
            at(harness, 'playing', 0);
            expect(harness.transition.phase).toBe('idle');
        });

        it('says the beam is on while the screen powers on as a line, and off as the line opens out', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            at(harness, 'revealing', POWER_ON_AT_MS - 1);
            expect(harness.transition.isBeamOn).toBe(false);
            at(harness, 'revealing', POWER_ON_AT_MS);
            expect(harness.transition.isBeamOn).toBe(true);
            at(harness, 'revealing', POWER_ON_AT_MS + POWER_ON_BEAM_MS - 1);
            expect(harness.transition.isBeamOn).toBe(true);
            at(harness, 'revealing', POWER_ON_AT_MS + POWER_ON_BEAM_MS + 1);
            expect(harness.transition.isBeamOn).toBe(false);
        });

        it('sets each part up as it begins, though a long frame skips the one before', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            at(harness, 'launching', 16);
            at(harness, 'revealing', SHOWING_AT_MS + 1);
            expect(harness.transition.phase).toBe('showing');
            expect(harness.transition.wallEffect).toBe('none');
            expect(harness.transition.picture.opacity).toBe(0);
            expect(harness.transition.backdropOpacity).toBe(0);
            expect(harness.transition.playRect).toEqual(PLAY);
            at(harness, 'playing', 16);
            expect(harness.transition.phase).toBe('idle');
        });

        it('starts blacked out, with the picture at the play area, for a link straight to an entry', () => {
            const harness = transitionHarness();
            harness.transition.holdGrown();
            expect(harness.transition.phase).toBe('holding');
            expect(windowOf(harness.transition)).toEqual(PLAY);
            expect(harness.transition.picture.border).toBe(0);
            expect(harness.transition.backdropOpacity).toBe(1);
            at(harness, 'launching', 200);
            expect(harness.transition.phase).toBe('holding');
            expect(harness.transition.waitedMs).toBe(200);
        });

        it('keeps the picture on the play area as the page lays it out, for a link straight to an entry', () => {
            const harness = transitionHarness();
            // Before the page has laid the play area out, there is nowhere to show it
            harness.target = { x: 0, y: 0, width: 0, height: 0 };
            harness.transition.holdGrown();
            expect(harness.transition.picture.width).toBe(0);
            harness.target = PLAY;
            at(harness, 'launching', 16);
            expect(windowOf(harness.transition)).toEqual(PLAY);
            at(harness, 'revealing', RECEDE_MS / 2);
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
        });

        it('eases the picture to the play area as it changes, for a link straight to an entry, rather than jumping', () => {
            const harness = transitionHarness();
            harness.transition.holdGrown();
            // The entry has loaded, and scales by whole numbers: its play area is smaller
            harness.target = { x: 50, y: 65, width: 400, height: 200 };
            at(harness, 'launching', 16);
            expect(harness.transition.picture.width).toBeLessThan(PLAY.width);
            expect(harness.transition.picture.width).toBeGreaterThan(400);
            for (let i = 0; i < 30; i++) at(harness, 'launching', 32 + i * 16);
            expect(harness.transition.picture.width).toBeCloseTo(400, 0);
            expect(centreOf(harness.transition).x).toBeCloseTo(PLAY_CENTRE.x);
        });
    });

    describe('going out', () => {
        it('powers the last frame off to a dot, brings the polaroid out of it, and floats it back onto its card as the cards develop', () => {
            const harness = playing();
            harness.transition.leaveTo(CARD, WALL);
            expect(harness.transition.phase).toBe('powering-off');
            expect(harness.transition.picture.showsEntryFrame).toBe(true);
            expect(windowOf(harness.transition)).toEqual(PLAY);
            harness.transition.update(POWER_OFF_MS * 0.2);
            expect(harness.transition.picture.scaleY).toBeLessThan(1);
            expect(harness.transition.picture.brightness).toBeGreaterThan(1);
            expect(harness.transition.glow.opacity).toBeGreaterThan(0);
            // The beam is off while the picture squashes. It comes on once the picture is a line, and lasts until the dot goes out.
            expect(harness.transition.isBeamOn).toBe(false);
            harness.transition.update(POWER_OFF_MS - POWER_OFF_BEAM_MS - POWER_OFF_MS * 0.2 + 1);
            expect(harness.transition.isBeamOn).toBe(true);
            harness.transition.update(POWER_OFF_MS);
            expect(harness.transition.phase).toBe('returning');
            expect(harness.transition.isBeamOn).toBe(false);
            expect(harness.transition.glow.opacity).toBe(0);
            expect(harness.transition.picture.showsEntryFrame).toBe(false);
            // Out of the dot: the polaroid, at the centre, its card's size, straight
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
            expect(harness.transition.picture.width).toBe(CARD.window.width);
            expect(harness.transition.picture.tilt).toBe(0);
            expect(harness.transition.picture.opacity).toBe(0);
            expect(harness.transition.wallEffect).toBe('develop');
            harness.transition.update(EMERGE_MS);
            expect(harness.transition.picture.scaleX).toBe(1);
            expect(harness.transition.picture.opacity).toBe(1);
            const [chosen, far] = [0, 2].map((i) => harness.transition.cardProgressAt(i));
            expect(chosen).toBeGreaterThan(far);
            harness.transition.update(FLOAT_BACK_DELAY_MS + FLOAT_BACK_MS - EMERGE_MS);
            expect(pictureOf(harness.transition)).toEqual(CARD);
            expect(harness.transition.backdropOpacity).toBe(0);
            harness.transition.update(RETURN_TOTAL_MS);
            expect(harness.transition.phase).toBe('idle');
            expect(harness.transition.wallEffect).toBe('none');
        });

        it('keeps its own clock on the way out, whatever the model\'s phase', () => {
            const harness = playing();
            harness.arcadePhase = 'browsing';
            harness.arcadeElapsedMs = 0;
            harness.transition.leaveTo(CARD, WALL);
            harness.transition.update(POWER_OFF_MS / 2);
            expect(harness.transition.phase).toBe('powering-off');
            harness.transition.update(POWER_OFF_MS / 2);
            expect(harness.transition.phase).toBe('returning');
        });

        it('powers off where the entry played, though the play area worked out on the way out differs', () => {
            const harness = playing();
            harness.target = { x: 10, y: 10, width: 900, height: 700 };
            harness.transition.leaveTo(CARD, WALL);
            expect(windowOf(harness.transition)).toEqual(PLAY);
        });

        it('brings the polaroid straight back if the entry was never seen, though it may have started behind it', () => {
            const harness = transitionHarness();
            harness.transition.enterFrom(CARD, WALL);
            at(harness, 'revealing', RECEDE_MS / 2);
            harness.transition.leaveTo(CARD, WALL);
            expect(harness.transition.phase).toBe('returning');
            expect(harness.transition.picture.opacity).toBeGreaterThan(0);
            harness.transition.update(FLOAT_BACK_DELAY_MS + FLOAT_BACK_MS);
            expect(pictureOf(harness.transition)).toEqual(CARD);
            harness.transition.update(RETURN_TOTAL_MS);
            expect(harness.transition.phase).toBe('idle');
        });

        it('shows no polaroid when there is no card to go back to', () => {
            const harness = playing();
            harness.transition.leaveTo(undefined, WALL);
            harness.transition.update(POWER_OFF_MS);
            harness.transition.update(EMERGE_MS);
            expect(harness.transition.picture.opacity).toBe(0);
        });
    });

    describe('for a visitor who has asked for less motion', () => {
        it('goes in by fading over the same parts of the model\'s time: the page round the polaroid, then the polaroid, then up into the entry', () => {
            const harness = transitionHarness({ isMotionReduced: true });
            harness.transition.enterFrom(CARD, WALL);
            expect(harness.transition.wallEffect).toBe('none');
            at(harness, 'launching', LAUNCH_MS / 2);
            expect(harness.transition.backdropOpacity).toBeGreaterThan(0);
            expect(harness.transition.backdropOpacity).toBeLessThan(1);
            at(harness, 'launching', LAUNCH_MS);
            expect(harness.transition.backdropOpacity).toBe(1);
            // Nothing moved
            expect(pictureOf(harness.transition)).toEqual(CARD);
            at(harness, 'revealing', RECEDE_MS / 2);
            expect(harness.transition.phase).toBe('receding');
            expect(pictureOf(harness.transition)).toEqual(CARD);
            expect(harness.transition.picture.scaleX).toBe(1);
            expect(harness.transition.picture.opacity).toBeGreaterThan(0);
            expect(harness.transition.picture.opacity).toBeLessThan(1);
            at(harness, 'revealing', POWER_ON_AT_MS);
            expect(harness.transition.phase).toBe('powering-on');
            expect(harness.transition.stage.isTransformed).toBe(false);
            expect(harness.transition.backdropOpacity).toBe(1);
            expect(harness.transition.glow.opacity).toBe(0);
            at(harness, 'revealing', POWER_ON_AT_MS + POWER_ON_MS / 2);
            expect(harness.transition.backdropOpacity).toBeCloseTo(0.5);
            at(harness, 'revealing', SHOWING_AT_MS);
            expect(harness.transition.phase).toBe('showing');
            expect(harness.transition.backdropOpacity).toBe(0);
            expect(harness.transition.isBeamOn).toBe(false);
            at(harness, 'playing', 0);
            expect(harness.transition.phase).toBe('idle');
        });

        it('goes out by fading: the last frame, then the page back, the polaroid on its card', () => {
            const harness = playing({ isMotionReduced: true });
            harness.transition.leaveTo(CARD, WALL);
            expect(harness.transition.phase).toBe('powering-off');
            harness.transition.update(QUIET_FADE_MS / 2);
            expect(harness.transition.picture.scaleY).toBe(1);
            expect(harness.transition.glow.opacity).toBe(0);
            expect(harness.transition.picture.opacity).toBeLessThan(1);
            harness.transition.update(QUIET_FADE_MS / 2);
            expect(harness.transition.phase).toBe('returning');
            expect(harness.transition.wallEffect).toBe('none');
            expect(pictureOf(harness.transition)).toEqual(CARD);
            expect(harness.transition.picture.opacity).toBe(1);
            harness.transition.update(QUIET_FADE_MS);
            expect(harness.transition.phase).toBe('idle');
            expect(harness.transition.backdropOpacity).toBe(0);
        });
    });

    it('draws nothing over the wall while idle on it', () => {
        const harness = transitionHarness();
        harness.transition.update(16);
        expect(harness.transition.phase).toBe('idle');
        expect(harness.transition.wallEffect).toBe('none');
        expect(harness.transition.cardProgressAt(0)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Harness {
    readonly transition: EntryTransitionViewModel;
    /** The model's phase, and how long it has lasted, as the bindings give them. */
    arcadePhase: ArcadePhase;
    arcadeElapsedMs: number;
    /** Where the entry would play, as worked out now. */
    target: Rect;
}

function transitionHarness(options: { isMotionReduced?: boolean } = {}): Harness {
    const harness: Harness = {
        transition: undefined as unknown as EntryTransitionViewModel,
        arcadePhase: 'browsing',
        arcadeElapsedMs: 0,
        target: PLAY,
    };
    (harness as { transition: EntryTransitionViewModel }).transition = createEntryTransitionViewModel({
        target: () => harness.target,
        arcadePhase: () => harness.arcadePhase,
        arcadeElapsedMs: () => harness.arcadeElapsedMs,
        isMotionReduced: () => options.isMotionReduced ?? false,
    });
    // As the model is when a launch begins
    harness.arcadePhase = 'launching';
    return harness;
}

/** Puts the model's time at `elapsedMs` into `phase`, and draws a frame there. */
function at(harness: Harness, phase: ArcadePhase, elapsedMs: number): void {
    harness.arcadePhase = phase;
    harness.arcadeElapsedMs = elapsedMs;
    harness.transition.update(16);
}

/** A harness with the entry gone in and running. */
function playing(options: { isMotionReduced?: boolean } = {}): Harness {
    const harness = transitionHarness(options);
    harness.transition.enterFrom(CARD, WALL);
    at(harness, 'launching', LAUNCH_MS - 1);
    at(harness, 'revealing', POWER_ON_AT_MS);
    at(harness, 'revealing', SHOWING_AT_MS);
    at(harness, 'playing', 0);
    expect(harness.transition.phase).toBe('idle');
    return harness;
}

function centreOf(transition: EntryTransitionViewModel): { x: number; y: number } {
    return { x: transition.picture.x + transition.picture.width / 2, y: transition.picture.y + transition.picture.height / 2 };
}

function windowOf(transition: EntryTransitionViewModel): Rect {
    return { x: transition.picture.x, y: transition.picture.y, width: transition.picture.width, height: transition.picture.height };
}

function pictureOf(transition: EntryTransitionViewModel): PicturePose {
    return {
        window: windowOf(transition),
        frame: { x: transition.picture.frameX, y: transition.picture.frameY, width: transition.picture.frameWidth, height: transition.picture.frameHeight },
        tilt: transition.picture.tilt,
        border: transition.picture.border,
    };
}
