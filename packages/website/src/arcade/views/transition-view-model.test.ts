import { describe, expect, it } from 'vitest';
import {
    BURN_MS, BURN_STAGGER_MS, createTransitionViewModel, EMERGE_MS, ENTER_MS, FLOAT_BACK_DELAY_MS, FLOAT_BACK_MS,
    FLOAT_DELAY_MS, FLOAT_MS, type PicturePose, POWER_OFF_MS, POWER_ON_MS, QUIET_FADE_MS, RECEDE_MS, RETURN_TOTAL_MS,
    type TransitionViewModel,
} from './transition-view-model';
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

describe('TransitionViewModel', () => {
    describe('going in', () => {
        it('floats the polaroid to the centre of the play area as the other cards burn, straightening it', () => {
            const harness = transitionHarness({ isReady: false });
            harness.transition.enterFrom(CARD, WALL);
            harness.transition.update(FLOAT_DELAY_MS);
            expect(pictureOf(harness.transition)).toEqual(CARD);
            harness.transition.update(FLOAT_MS / 2);
            expect(harness.transition.picture.x).toBeGreaterThan(CARD.window.x);
            expect(harness.transition.picture.tilt).toBeGreaterThan(0);
            expect(harness.transition.picture.tilt).toBeLessThan(CARD.tilt);
            harness.transition.update(ENTER_MS);
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
            expect(harness.transition.picture.width).toBe(CARD.window.width);
            expect(harness.transition.picture.border).toBe(CARD.border);
            expect(harness.transition.picture.tilt).toBe(0);
            expect(harness.transition.picture.opacity).toBe(1);
        });

        it('burns the cards nearest the polaroid first, and all of them by the end', () => {
            const harness = transitionHarness({ isReady: false });
            harness.transition.enterFrom(CARD, WALL);
            expect(harness.transition.wallEffect).toBe('burn');
            harness.transition.update(BURN_MS / 2);
            const [chosen, beside, far] = [0, 1, 2].map((i) => harness.transition.cardProgressAt(i));
            expect(chosen).toBeGreaterThan(beside);
            expect(beside).toBeGreaterThan(far);
            harness.transition.update(BURN_STAGGER_MS + BURN_MS / 2 - 1);
            // The furthest finishes as the way in does
            for (let i = 0; i < 3; i++) expect(harness.transition.cardProgressAt(i)).toBeGreaterThan(0.99);
        });

        it('draws nothing over the wall once the page is black, while the entry loads and plays', () => {
            const harness = transitionHarness({ isReady: false });
            harness.transition.enterFrom(CARD, WALL);
            harness.transition.update(ENTER_MS);
            expect(harness.transition.phase).toBe('holding');
            expect(harness.transition.wallEffect).toBe('none');
        });

        it('blacks the page out once the cards have burnt', () => {
            const harness = transitionHarness({ isReady: false });
            harness.transition.enterFrom(CARD, WALL);
            expect(harness.transition.backdropOpacity).toBe(0);
            harness.transition.update(ENTER_MS);
            expect(harness.transition.backdropOpacity).toBe(1);
        });

        it('holds the polaroid until the entry has loaded, and says it is waiting', () => {
            const harness = transitionHarness({ isReady: false });
            harness.transition.enterFrom(CARD, WALL);
            harness.transition.update(ENTER_MS);
            expect(harness.transition.phase).toBe('holding');
            expect(harness.transition.isWaiting).toBe(true);
            harness.transition.update(500);
            expect(harness.transition.waitedMs).toBe(500);
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
            expect(harness.handOvers).toBe(0);
            harness.isReady = true;
            harness.transition.update(16);
            expect(harness.transition.phase).toBe('receding');
            expect(harness.transition.isWaiting).toBe(false);
        });

        it('recedes the polaroid, hands over, waits for the entry to draw, then powers it on from a white-hot line', () => {
            const harness = transitionHarness({ isReady: true });
            harness.transition.enterFrom(CARD, WALL);
            harness.transition.update(ENTER_MS);
            expect(harness.transition.phase).toBe('receding');
            harness.transition.update(RECEDE_MS / 2);
            expect(harness.transition.picture.scaleX).toBeLessThan(1);
            expect(harness.transition.picture.opacity).toBeLessThan(1);
            expect(centreOf(harness.transition)).toEqual(PLAY_CENTRE);
            harness.transition.update(RECEDE_MS / 2);
            // Gone into the dark: the entry starts, its screen off, about where it plays
            expect(harness.transition.phase).toBe('starting');
            expect(harness.handOvers).toBe(1);
            expect(harness.transition.picture.opacity).toBe(0);
            expect(harness.transition.playRect).toEqual(PLAY);
            expect(harness.transition.stage.isTransformed).toBe(true);
            expect(harness.transition.stage.scaleX).toBe(0);
            // Not running yet: no power
            harness.transition.update(16);
            expect(harness.transition.phase).toBe('starting');
            harness.isPlaying = true;
            harness.transition.update(16);
            expect(harness.transition.phase).toBe('powering-on');
            expect(harness.transition.backdropOpacity).toBe(0);
            harness.transition.update(POWER_ON_MS * 0.2);
            // A white-hot line, growing across
            expect(harness.transition.stage.scaleX).toBeGreaterThan(0);
            expect(harness.transition.stage.scaleY).toBeLessThan(0.05);
            expect(harness.transition.stage.brightness).toBeGreaterThan(1);
            expect(harness.transition.glow.opacity).toBe(1);
            expect(harness.transition.glow.width).toBeGreaterThan(0);
            expect(harness.transition.glow.width).toBeLessThan(PLAY.width);
            expect(harness.transition.glow.height).toBeLessThan(5);
            harness.transition.update(POWER_ON_MS);
            expect(harness.transition.glow.opacity).toBe(0);
            expect(harness.transition.phase).toBe('idle');
            expect(harness.transition.stage.isTransformed).toBe(false);
            expect(harness.transition.stage.scaleY).toBe(1);
            expect(harness.transition.stage.brightness).toBe(1);
            expect(harness.handOvers).toBe(1);
        });

        it('starts blacked out, with the picture at the play area, for a link straight to an entry', () => {
            const harness = transitionHarness({ isReady: false });
            harness.transition.holdGrown();
            expect(harness.transition.phase).toBe('holding');
            expect(windowOf(harness.transition)).toEqual(PLAY);
            expect(harness.transition.picture.border).toBe(0);
            expect(harness.transition.backdropOpacity).toBe(1);
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
            harness.transition.update(POWER_OFF_MS);
            expect(harness.transition.phase).toBe('returning');
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

        it('powers off where the entry played, though the play area worked out on the way out differs', () => {
            const harness = playing();
            harness.target = { x: 10, y: 10, width: 900, height: 700 };
            harness.transition.leaveTo(CARD, WALL);
            expect(windowOf(harness.transition)).toEqual(PLAY);
        });

        it('brings the polaroid straight back if the entry never started', () => {
            const harness = transitionHarness({ isReady: false });
            harness.transition.enterFrom(CARD, WALL);
            harness.transition.update(ENTER_MS);
            harness.transition.leaveTo(CARD, WALL);
            expect(harness.transition.phase).toBe('returning');
            expect(harness.transition.picture.opacity).toBe(1);
            harness.transition.update(FLOAT_BACK_DELAY_MS + FLOAT_BACK_MS);
            expect(pictureOf(harness.transition)).toEqual(CARD);
            harness.transition.update(RETURN_TOTAL_MS);
            expect(harness.transition.phase).toBe('idle');
            expect(harness.handOvers).toBe(0);
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
        it('goes in by fading: the page round the polaroid, then the polaroid, then up into the entry', () => {
            const harness = transitionHarness({ isReady: true, isMotionReduced: true });
            harness.transition.enterFrom(CARD, WALL);
            expect(harness.transition.wallEffect).toBe('none');
            harness.transition.update(QUIET_FADE_MS / 2);
            expect(harness.transition.backdropOpacity).toBeGreaterThan(0);
            expect(harness.transition.backdropOpacity).toBeLessThan(1);
            harness.transition.update(QUIET_FADE_MS / 2);
            // Nothing moved
            expect(pictureOf(harness.transition)).toEqual(CARD);
            expect(harness.transition.phase).toBe('receding');
            harness.transition.update(QUIET_FADE_MS / 2);
            expect(harness.transition.picture.scaleX).toBe(1);
            expect(harness.transition.picture.opacity).toBeGreaterThan(0);
            expect(harness.transition.picture.opacity).toBeLessThan(1);
            harness.transition.update(QUIET_FADE_MS / 2);
            expect(harness.handOvers).toBe(1);
            expect(harness.transition.stage.isTransformed).toBe(false);
            harness.isPlaying = true;
            harness.transition.update(16);
            expect(harness.transition.phase).toBe('powering-on');
            expect(harness.transition.backdropOpacity).toBe(1);
            expect(harness.transition.glow.opacity).toBe(0);
            harness.transition.update(QUIET_FADE_MS / 2);
            expect(harness.transition.backdropOpacity).toBeLessThan(1);
            harness.transition.update(QUIET_FADE_MS / 2);
            expect(harness.transition.phase).toBe('idle');
            expect(harness.transition.backdropOpacity).toBe(0);
        });

        it('goes out by fading: the last frame, then the page back, the polaroid on its card', () => {
            const harness = transitionHarness({ isReady: true, isMotionReduced: true });
            harness.transition.enterFrom(CARD, WALL);
            harness.transition.update(QUIET_FADE_MS);
            harness.transition.update(QUIET_FADE_MS);
            harness.isPlaying = true;
            harness.transition.update(16);
            harness.transition.update(QUIET_FADE_MS);
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
        const harness = transitionHarness({ isReady: false });
        expect(harness.transition.wallEffect).toBe('none');
        expect(harness.transition.cardProgressAt(0)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Harness {
    readonly transition: TransitionViewModel;
    isReady: boolean;
    isPlaying: boolean;
    handOvers: number;
    /** Where the entry would play, as worked out now. */
    target: Rect;
}

function transitionHarness(options: { isReady: boolean; isMotionReduced?: boolean }): Harness {
    const harness: Harness = {
        transition: undefined as unknown as TransitionViewModel,
        isReady: options.isReady,
        isPlaying: false,
        handOvers: 0,
        target: PLAY,
    };
    (harness as { transition: TransitionViewModel }).transition = createTransitionViewModel({
        target: () => harness.target,
        isReady: () => harness.isReady,
        isPlaying: () => harness.isPlaying,
        onHandOver: () => {
            harness.handOvers++;
        },
        isMotionReduced: () => options.isMotionReduced ?? false,
    });
    return harness;
}

/** A harness with the entry gone in and running. */
function playing(): Harness {
    const harness = transitionHarness({ isReady: true });
    harness.transition.enterFrom(CARD, WALL);
    harness.transition.update(ENTER_MS);
    harness.transition.update(RECEDE_MS);
    harness.isPlaying = true;
    harness.transition.update(16);
    harness.transition.update(POWER_ON_MS);
    expect(harness.transition.phase).toBe('idle');
    return harness;
}

function centreOf(transition: TransitionViewModel): { x: number; y: number } {
    return { x: transition.picture.x + transition.picture.width / 2, y: transition.picture.y + transition.picture.height / 2 };
}

function windowOf(transition: TransitionViewModel): Rect {
    return { x: transition.picture.x, y: transition.picture.y, width: transition.picture.width, height: transition.picture.height };
}

function pictureOf(transition: TransitionViewModel): PicturePose {
    return {
        window: windowOf(transition),
        frame: { x: transition.picture.frameX, y: transition.picture.frameY, width: transition.picture.frameWidth, height: transition.picture.frameHeight },
        tilt: transition.picture.tilt,
        border: transition.picture.border,
    };
}
