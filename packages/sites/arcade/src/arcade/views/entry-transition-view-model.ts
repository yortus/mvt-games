import {
    BACKDROP_DELAY_MS, BACKDROP_MS, BURN_MS, BURN_STAGGER_MS, FLOAT_DELAY_MS, FLOAT_MS, LAUNCH_MS, POWER_ON_MS, RECEDE_MS,
} from '../data';
import type { ArcadePhase } from '../models';
import type { PhotoPose } from './card-photo';
import { NO_RECT, type Rect } from './rect';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The way into an entry and back out, as presentation state: the Arcade's view
 * owns it, advances it in `update`, and its views draw it in `refresh`.
 *
 * In: the other cards burn away as the chosen card's polaroid floats to the
 * centre of where the entry will play, straightening, and the page blacks
 * out; the entry loads meanwhile, and a slow load holds the polaroid there.
 * Then the polaroid recedes into the dark over the entry, which has started
 * but is not seen yet, and the entry's screen powers on from that centre.
 * The entry's first frame then shows still for a moment before the entry
 * runs. The picture and the entry are never seen together, so neither a
 * blank first frame nor a game that has moved on from its thumbnail shows.
 *
 * The model times the way in, because it decides when the entry starts and
 * when it runs. So this view model has no clock for it: it draws each part
 * from the model's phase and how long that has lasted, with the durations
 * they share (`../data`).
 *
 * Out: the entry's last frame powers off to a line and a dot, the polaroid
 * comes back out of the dark there and floats back onto its card, and the
 * cards develop around it, the nearest first. That changes nothing the
 * model waits for, so it keeps its own clock.
 *
 * For a visitor who has asked for less motion (`isMotionReduced`), it is
 * quiet: in, the page fades to black round the polaroid, the polaroid fades,
 * and the entry fades up, each over the same part of the model's time as the
 * full way in, so the entry runs at the same moment; out, the last frame
 * fades, and the page fades back with the polaroid on its card. Nothing
 * moves, burns or flashes.
 */
export interface EntryTransitionViewModel {
    readonly phase: EntryTransitionPhase;
    /** The polaroid, or the entry's last frame, as drawn now. Updated in place. */
    readonly picture: EntryTransitionPicture;
    /** How far the page behind is blacked out, from 0 to 1. */
    readonly backdropOpacity: number;
    /**
     * Where the entry plays, as it was when its screen began to power on:
     * the stage powers on about its centre. On a turned play area
     * (`playTurn`), it is the play area's own width and height, about the
     * centre where it shows.
     */
    readonly playRect: Rect;
    /** How far the play area was turned, in degrees clockwise, as the screen began to power on: 0, or 90 for a game played on its side. */
    readonly playTurn: number;
    /** The stage the entry plays on, as it powers on. Updated in place. */
    readonly stage: EntryTransitionStage;
    /** The white-hot line of a tube powering on or off, over the play area's centre. Updated in place. */
    readonly glow: EntryTransitionGlow;
    /**
     * Whether the tube's beam is concentrated into a line or a dot. It is on
     * as the screen powers on, until the line opens out, and as it powers
     * off, from the line to the dot. It is never on for a visitor who has
     * asked for less motion.
     */
    readonly isBeamOn: boolean;

    /** What is drawn over the wall's cards now. */
    readonly wallEffect: WallEffectKind;
    /** How many cards the wall effect covers. */
    readonly cardCount: number;
    /** Card `index`'s rectangle in the viewport, as it was when the transition started. */
    readonly cardRectAt: (index: number) => Rect;
    /** How far card `index` has burnt, or developed, from 0 to 1. */
    readonly cardProgressAt: (index: number) => number;

    /** Whether loading is taking long enough to show that it is going on. */
    readonly isWaiting: boolean;
    /** How long it has been waiting, for the waiting bar's movement. */
    readonly waitedMs: number;

    /** Goes in from a card's polaroid, burning the other cards, at `cards` (zero-sized where not on the wall). */
    readonly enterFrom: (from: PicturePose, cards: readonly Rect[]) => void;
    /**
     * Goes in with the page blacked out and the picture at the play area, as
     * for a link straight to an entry. The picture follows the play area, as
     * the page lays it out.
     */
    readonly holdGrown: () => void;
    /**
     * Goes back out to a card's polaroid, from wherever the transition is,
     * developing `cards`; with no card to go to, the cards just develop.
     */
    readonly leaveTo: (to: PicturePose | undefined, cards: readonly Rect[]) => void;
    /** Draws the way in as far as the model has got, or advances the way out. */
    readonly update: (deltaMs: number) => void;
}

/**
 * Where the transition is:
 * - `'idle'`: nothing moving: the wall, or the entry running.
 * - `'entering'`: the other cards burn away as the chosen card's polaroid
 *   floats to the centre of where the entry will play, and the page blacks out.
 * - `'holding'`: waiting for the entry to finish loading.
 * - `'receding'`: the polaroid recedes into the dark. The entry has started
 *   behind it, and is not seen yet.
 * - `'powering-on'`: the entry's screen powers on, like an old tube: a
 *   white-hot line across the middle, opening out to the picture.
 * - `'showing'`: the entry's first frame shows still for a moment, before
 *   the entry runs, so the visitor can take it in.
 * - `'powering-off'`: the entry's last frame powers off: a line, then a dot.
 * - `'returning'`: the polaroid comes back out of the dark and floats back
 *   onto its card, and the cards develop around it.
 */
export type EntryTransitionPhase =
    | 'idle'
    | 'entering'
    | 'holding'
    | 'receding'
    | 'powering-on'
    | 'showing'
    | 'powering-off'
    | 'returning';

/** What is drawn over the wall's cards: nothing, their burning, or their developing. */
export type WallEffectKind = 'none' | 'burn' | 'develop';

/**
 * A photo's pose, and the whole picture behind its window. On a card, the
 * window shows part of the picture, tilted, in a border; at the play area,
 * window and picture are one, straight, with no border.
 */
export interface PicturePose extends PhotoPose {
    /** The whole picture, as if untilted. */
    readonly frame: Rect;
}

/** The picture as drawn: a window on the whole picture, in a polaroid's border or none. */
export interface EntryTransitionPicture {
    /** The window, in the viewport, as if untilted: it turns about its centre. */
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    /** Degrees, clockwise, about its centre. */
    readonly tilt: number;
    /** The whole picture, behind the window, as if untilted. */
    readonly frameX: number;
    readonly frameY: number;
    readonly frameWidth: number;
    readonly frameHeight: number;
    /** The polaroid's border round the window, in CSS pixels; 0 for none. */
    readonly border: number;
    readonly opacity: number;
    /** Squashed or shrunk about its centre. */
    readonly scaleX: number;
    readonly scaleY: number;
    /** 1 as it is; more, brighter. */
    readonly brightness: number;
    /** Whether it shows the entry's last frame, rather than its thumbnail. */
    readonly showsEntryFrame: boolean;
}

/** The entry's stage as it powers on: squashed about the play area's centre, and brightened. */
export interface EntryTransitionStage {
    /** Whether it is squashed or brightened at all; otherwise it is left as it is. */
    readonly isTransformed: boolean;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly brightness: number;
}

/** A tube's white-hot line: how strongly it shows, and its size in CSS pixels. */
export interface EntryTransitionGlow {
    readonly opacity: number;
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface EntryTransitionViewModelOptions {
    /**
     * Where the entry plays, which can change as the entry loads, and as the
     * page lays the play area out. On a turned play area, it is the play
     * area's own width and height, about the centre where it shows.
     */
    readonly target: () => Rect;
    /**
     * How far the play area is turned, in degrees clockwise: 0, or 90 for a
     * game played on its side, on a phone held upright. The polaroid turns
     * with it as it floats there. Defaults to 0.
     */
    readonly turn?: () => number;
    /** The Arcade's phase, which times the way in. */
    readonly arcadePhase: () => ArcadePhase;
    /** How long the Arcade's phase has lasted, in milliseconds. */
    readonly arcadeElapsedMs: () => number;
    /** Whether the visitor has asked for less motion: read as each way in or out starts. */
    readonly isMotionReduced: () => boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEntryTransitionViewModel(options: EntryTransitionViewModelOptions): EntryTransitionViewModel {
    let phase: EntryTransitionPhase = 'idle';
    /** How long the phase has lasted: on the way in, as the model's time says; on the way out, by its own clock. */
    let elapsedMs = 0;
    /** Whether this way in or out is the quiet one, for a visitor who has asked for less motion. */
    let isQuiet = false;
    /** Whether the way in is drawing, from the model's phase. */
    let isGoingIn = false;
    /** Whether this way in started with the picture at the play area, with no wall to leave. */
    let isGrown = false;

    // As drawn: records updated in place, so a frame of the transition makes nothing
    const picture: Writable<EntryTransitionPicture> = {
        x: 0, y: 0, width: 0, height: 0, tilt: 0,
        frameX: 0, frameY: 0, frameWidth: 0, frameHeight: 0,
        border: 0, opacity: 0, scaleX: 1, scaleY: 1, brightness: 1, showsEntryFrame: false,
    };
    const stage: Writable<Omit<EntryTransitionStage, 'isTransformed'>> & Pick<EntryTransitionStage, 'isTransformed'> = {
        get isTransformed() {
            return !isQuiet && phase === 'powering-on';
        },
        scaleX: 1,
        scaleY: 1,
        brightness: 1,
    };
    const glow: Writable<EntryTransitionGlow> = { opacity: 0, width: 0, height: 0 };
    let backdropOpacity = 0;

    /** The polaroid as it lay on its card when chosen: it floats from there to the centre. */
    let launched: PicturePose | undefined;
    /** How far it has floated to the centre, from 0 to 1. */
    let floated = 0;
    /**
     * Where the entry played, as its screen began to power on: on the way
     * out, the entry's starter has gone, and the play area worked out
     * without it can differ (an entry scaled by whole numbers, say).
     */
    let playedRect: Rect = NO_RECT;
    /** How far the play area was turned, as the screen began to power on. */
    let playedTurn = 0;
    const turnOf = options.turn ?? (() => 0);
    /** On the way back: where the polaroid floats from, and to, and the scale and opacity it comes forward from. */
    let returnFrom: PicturePose | undefined;
    let returnTo: PicturePose | undefined;
    let returnFromScale = 1;
    let returnFromOpacity = 1;

    let wallEffect: WallEffectKind = 'none';
    let cards: readonly Rect[] = [];
    /** When each card starts to burn or develop, after its phase starts: the nearest to the polaroid first. */
    let cardDelays: number[] = [];

    const transition: EntryTransitionViewModel = {
        get phase() {
            return phase;
        },
        get isBeamOn() {
            if (isQuiet) return false;
            if (phase === 'powering-on') return elapsedMs < POWER_ON_BEAM_MS;
            return phase === 'powering-off' && elapsedMs >= POWER_OFF_MS - POWER_OFF_BEAM_MS;
        },
        picture,
        get backdropOpacity() {
            return backdropOpacity;
        },
        get playTurn() {
            return playedTurn;
        },
        get playRect() {
            return playedRect;
        },
        stage,
        glow,
        get wallEffect() {
            return wallEffect;
        },
        get cardCount() {
            return cards.length;
        },
        cardRectAt: (index) => cards[index] ?? NO_RECT,
        cardProgressAt(index) {
            if (wallEffect === 'burn') return progressAfter(cardDelays[index], BURN_MS);
            if (wallEffect === 'develop') return progressAfter(cardDelays[index], DEVELOP_MS);
            return 0;
        },
        get isWaiting() {
            return phase === 'holding';
        },
        get waitedMs() {
            return phase === 'holding' ? elapsedMs : 0;
        },

        enterFrom(start, wall) {
            isQuiet = options.isMotionReduced();
            isGoingIn = true;
            isGrown = false;
            playedRect = NO_RECT;
            launched = start;
            floated = 0;
            place(start, start, 0);
            resetPicture();
            picture.opacity = 1;
            backdropOpacity = 0;
            cards = wall;
            cardDelays = delaysFrom(wall, centreOf(start.window), BURN_STAGGER_MS);
            // Quietly, the page just fades out under the backdrop
            wallEffect = isQuiet ? 'none' : 'burn';
            enter('entering', 0);
        },
        holdGrown() {
            isQuiet = options.isMotionReduced();
            isGoingIn = true;
            isGrown = true;
            playedRect = NO_RECT;
            launched = undefined;
            // Wherever the last way in left it, the picture starts afresh at the play area
            picture.width = 0;
            placeGrown(0);
            resetPicture();
            picture.opacity = 1;
            backdropOpacity = 1;
            cards = [];
            cardDelays = [];
            wallEffect = 'none';
            enter('holding', 0);
        },
        leaveTo(end, wall) {
            if (phase === 'powering-off' || phase === 'returning') return;
            isQuiet = options.isMotionReduced();
            isGoingIn = false;
            cards = wall;
            cardDelays = delaysFrom(wall, end === undefined ? undefined : centreOf(end.window), DEVELOP_STAGGER_MS);
            backdropOpacity = 1;
            glow.opacity = 0;
            // The entry was never seen: the polaroid, as it is, comes back onto its card
            if (phase === 'entering' || phase === 'holding' || phase === 'receding') {
                if (isQuiet) startReturning(end, end, 1, 1);
                else startReturning(pictureNow(), end, picture.scaleX, launched === undefined ? 0 : picture.opacity);
                return;
            }
            // The entry was seen: its last frame, where it played, powers off first
            returnTo = end;
            const played: PicturePose = { window: playedRect, frame: playedRect, tilt: playedTurn, border: 0 };
            place(played, played, 0);
            resetPicture();
            picture.opacity = 1;
            picture.showsEntryFrame = true;
            enter('powering-off', 0);
        },

        update(deltaMs) {
            switch (phase) {
                case 'powering-off':
                    elapsedMs += deltaMs;
                    updatePoweringOff();
                    return;
                case 'returning':
                    elapsedMs += deltaMs;
                    updateReturning();
                    return;
                default:
                    if (isGoingIn) followWayIn(deltaMs);
            }
        },
    };

    return transition;

    function enter(next: EntryTransitionPhase, elapsed: number): void {
        phase = next;
        elapsedMs = elapsed;
    }

    // --- The way in ---------------------------------------------------------

    /**
     * Draws the part of the way in that the model's phase and time say it
     * has reached. A long frame can skip a part, so each part sets up all it
     * needs as it begins, whatever came before.
     */
    function followWayIn(deltaMs: number): void {
        const arcadePhase = options.arcadePhase();
        const t = options.arcadeElapsedMs();
        const previous = phase;
        if (arcadePhase === 'launching') {
            if (!isGrown && t < LAUNCH_MS) enter('entering', t);
            else enter('holding', isGrown ? t : t - LAUNCH_MS);
        }
        else if (arcadePhase === 'revealing') {
            if (t < RECEDE_MS) enter('receding', t);
            else if (t < RECEDE_MS + POWER_ON_MS) enter('powering-on', t - RECEDE_MS);
            else enter('showing', t - RECEDE_MS - POWER_ON_MS);
        }
        else {
            // Playing: the way in is done
            isGoingIn = false;
            finish();
            picture.opacity = 0;
            backdropOpacity = 0;
            glow.opacity = 0;
            return;
        }
        if (phase !== previous) beginWayInPart();
        switch (phase) {
            case 'entering':
                updateEntering();
                return;
            case 'holding':
                placeHeld(deltaMs);
                return;
            case 'receding':
                placeHeld(deltaMs);
                updateReceding();
                return;
            case 'powering-on':
                updatePoweringOn();
                return;
        }
    }

    /** Sets up the part of the way in just reached. */
    function beginWayInPart(): void {
        if (phase === 'entering') return;
        // The page is black now: nothing to draw over the cards until they develop on the way back
        wallEffect = 'none';
        if (phase === 'holding' || phase === 'receding') {
            // Quietly, the polaroid stays on its card
            if (!isQuiet) floated = 1;
            backdropOpacity = 1;
            return;
        }
        // The polaroid has gone, and the entry, started, is about to be seen
        picture.opacity = 0;
        if (phase === 'powering-on') {
            playedRect = options.target();
            playedTurn = turnOf();
            if (isQuiet) {
                // The backdrop fades off the entry
                backdropOpacity = 1;
            }
            else {
                // The stage, a line on black, covers the page: the backdrop goes
                backdropOpacity = 0;
                stage.scaleX = 0;
                stage.scaleY = LINE_SCALE;
                stage.brightness = POWER_BRIGHTNESS;
            }
            return;
        }
        // Showing: the entry's first frame, still, as it rests. A long frame may have skipped the power-on
        if (playedRect === NO_RECT) {
            playedRect = options.target();
            playedTurn = turnOf();
        }
        finish('showing');
        backdropOpacity = 0;
        glow.opacity = 0;
    }

    /** The cards burn as the polaroid floats to the centre, and the page blacks out (quietly, just fades). */
    function updateEntering(): void {
        if (isQuiet) {
            // The page fades to black round the polaroid, which stays put
            backdropOpacity = clamp01(elapsedMs / LAUNCH_MS);
            return;
        }
        floated = ease(clamp01((elapsedMs - FLOAT_DELAY_MS) / FLOAT_MS));
        placeFloating();
        backdropOpacity = clamp01((elapsedMs - BACKDROP_DELAY_MS) / BACKDROP_MS);
    }

    /** The polaroid where it waits: at the play area's centre, having floated there, or grown to the play area. */
    function placeHeld(deltaMs: number): void {
        if (isGrown) placeGrown(deltaMs);
        else placeFloating();
    }

    /** The polaroid `floated` of the way from its card to the play area's centre, straightening as it goes. */
    function placeFloating(): void {
        if (launched === undefined) return;
        const target = options.target();
        const window = launched.window;
        const dx = (target.x + target.width / 2 - (window.x + window.width / 2)) * floated;
        const dy = (target.y + target.height / 2 - (window.y + window.height / 2)) * floated;
        picture.x = window.x + dx;
        picture.y = window.y + dy;
        picture.width = window.width;
        picture.height = window.height;
        picture.frameX = launched.frame.x + dx;
        picture.frameY = launched.frame.y + dy;
        picture.frameWidth = launched.frame.width;
        picture.frameHeight = launched.frame.height;
        picture.tilt = launched.tilt * (1 - floated) + turnOf() * floated;
        picture.border = launched.border;
    }

    /**
     * The picture filling the play area. The play area can change as the
     * page lays it out, and again as the entry loads and says how it scales,
     * so the picture eases to it over `deltaMs`, rather than jumping. It is
     * put there at once the first time there is a play area, and always on
     * the quiet way in.
     */
    function placeGrown(deltaMs: number): void {
        const target = options.target();
        const isFirst = picture.width === 0 || picture.height === 0;
        const follow = isFirst || isQuiet ? 1 : 1 - Math.exp(-deltaMs / GROWN_EASE_MS);
        picture.x += (target.x - picture.x) * follow;
        picture.y += (target.y - picture.y) * follow;
        picture.width += (target.width - picture.width) * follow;
        picture.height += (target.height - picture.height) * follow;
        picture.frameX = picture.x;
        picture.frameY = picture.y;
        picture.frameWidth = picture.width;
        picture.frameHeight = picture.height;
        picture.tilt = turnOf();
        picture.border = 0;
    }

    /** The polaroid shrinks away into the dark (quietly, fades), over the entry, started but not seen. */
    function updateReceding(): void {
        const t = isQuiet ? clamp01(elapsedMs / RECEDE_MS) : easeIn(clamp01(elapsedMs / RECEDE_MS));
        if (!isQuiet) {
            picture.scaleX = 1 - (1 - RECEDED_SCALE) * t;
            picture.scaleY = picture.scaleX;
        }
        picture.opacity = 1 - t;
    }

    /** A white-hot line across the middle, then the line opening out to the picture, the glow fading as it opens (quietly, the entry fades up). */
    function updatePoweringOn(): void {
        const t = clamp01(elapsedMs / POWER_ON_MS);
        if (isQuiet) {
            backdropOpacity = 1 - t;
            return;
        }
        if (t < POWER_LINE_SHARE) {
            stage.scaleX = easeOut(t / POWER_LINE_SHARE);
            stage.scaleY = LINE_SCALE;
            stage.brightness = POWER_BRIGHTNESS;
            glow.opacity = 1;
        }
        else {
            const open = easeOut((t - POWER_LINE_SHARE) / (1 - POWER_LINE_SHARE));
            stage.scaleX = 1;
            stage.scaleY = LINE_SCALE + (1 - LINE_SCALE) * open;
            stage.brightness = POWER_BRIGHTNESS + (1 - POWER_BRIGHTNESS) * open;
            glow.opacity = 1 - clamp01(open / GLOW_FADE_SHARE);
        }
        glowOver(stage.scaleX, stage.scaleY);
    }

    // --- The way out --------------------------------------------------------

    /** The last frame squashes to a white-hot line, and the line to a dot (quietly, fades). */
    function updatePoweringOff(): void {
        if (isQuiet) {
            picture.opacity = 1 - clamp01(elapsedMs / QUIET_FADE_MS);
            if (elapsedMs >= QUIET_FADE_MS) startReturning(returnTo, returnTo, 1, 1);
            return;
        }
        const t = clamp01(elapsedMs / POWER_OFF_MS);
        if (t < POWER_LINE_SHARE) {
            const k = easeIn(t / POWER_LINE_SHARE);
            picture.scaleY = 1 - (1 - LINE_SCALE) * k;
            picture.brightness = 1 + (POWER_BRIGHTNESS - 1) * k;
            glow.opacity = k;
        }
        else {
            picture.scaleY = LINE_SCALE;
            picture.scaleX = 1 - easeIn((t - POWER_LINE_SHARE) / (1 - POWER_LINE_SHARE));
            picture.brightness = POWER_BRIGHTNESS;
            glow.opacity = 1;
        }
        glowOver(picture.scaleX, picture.scaleY);
        if (t < 1) return;
        glow.opacity = 0;
        startReturning(returnTo === undefined ? undefined : centredOnPlay(returnTo), returnTo, RECEDED_SCALE, 0);
    }

    /**
     * The polaroid comes forward from `scale` and `opacity`, at `from`, then
     * floats back onto its card at `to`, as the cards develop.
     */
    function startReturning(from: PicturePose | undefined, to: PicturePose | undefined, scale: number, opacity: number): void {
        returnFrom = from;
        returnTo = to;
        if (from !== undefined) place(from, from, 0);
        resetPicture();
        picture.scaleX = scale;
        picture.scaleY = scale;
        picture.opacity = from === undefined || to === undefined ? 0 : opacity;
        returnFromScale = scale;
        returnFromOpacity = picture.opacity;
        wallEffect = isQuiet ? 'none' : 'develop';
        enter('returning', 0);
    }

    function updateReturning(): void {
        if (isQuiet) {
            // The page fades back, the polaroid already on its card
            backdropOpacity = 1 - clamp01(elapsedMs / QUIET_FADE_MS);
            if (elapsedMs < QUIET_FADE_MS) return;
            finish();
            picture.opacity = 0;
            return;
        }
        backdropOpacity = 1 - easeOut(clamp01(elapsedMs / BACKDROP_OUT_MS));
        if (returnFrom !== undefined && returnTo !== undefined) {
            const emerged = easeOut(clamp01(elapsedMs / EMERGE_MS));
            picture.scaleX = returnFromScale + (1 - returnFromScale) * emerged;
            picture.scaleY = picture.scaleX;
            picture.opacity = returnFromOpacity + (1 - returnFromOpacity) * emerged;
            place(returnFrom, returnTo, ease(clamp01((elapsedMs - FLOAT_BACK_DELAY_MS) / FLOAT_BACK_MS)));
        }
        if (elapsedMs < RETURN_TOTAL_MS) return;
        wallEffect = 'none';
        finish();
        picture.opacity = 0;
        backdropOpacity = 0;
    }

    // --- Helpers ------------------------------------------------------------

    /**
     * Ends the way in or out, and enters phase `next`, which is `'idle'`
     * unless given. It puts the stage and the picture back as they rest.
     */
    function finish(next: EntryTransitionPhase = 'idle'): void {
        enter(next, 0);
        resetPicture();
        stage.scaleX = 1;
        stage.scaleY = 1;
        stage.brightness = 1;
    }

    function resetPicture(): void {
        picture.scaleX = 1;
        picture.scaleY = 1;
        picture.brightness = 1;
        picture.showsEntryFrame = false;
    }

    /** The glow over the play area's centre, the size of the screen squashed by `scaleX` and `scaleY`, never thinner than a line. */
    function glowOver(scaleX: number, scaleY: number): void {
        glow.width = playedRect.width * scaleX;
        glow.height = Math.max(GLOW_MIN_HEIGHT, playedRect.height * scaleY);
    }

    /**
     * `pose`, the size it is on its card, but at the play area's centre, and
     * straight, or turned as the play area was: where it comes out of the dot.
     */
    function centredOnPlay(pose: PicturePose): PicturePose {
        const centre = centreOf(playedRect);
        const dx = centre.x - (pose.window.x + pose.window.width / 2);
        const dy = centre.y - (pose.window.y + pose.window.height / 2);
        return {
            window: { ...pose.window, x: pose.window.x + dx, y: pose.window.y + dy },
            frame: { ...pose.frame, x: pose.frame.x + dx, y: pose.frame.y + dy },
            tilt: playedTurn,
            border: pose.border,
        };
    }

    function pictureNow(): PicturePose {
        return {
            window: { x: picture.x, y: picture.y, width: picture.width, height: picture.height },
            frame: { x: picture.frameX, y: picture.frameY, width: picture.frameWidth, height: picture.frameHeight },
            tilt: picture.tilt,
            border: picture.border,
        };
    }

    function progressAfter(delayMs: number, durationMs: number): number {
        return clamp01((elapsedMs - delayMs) / durationMs);
    }

    /** The picture `t` of the way from `a` to `b`. */
    function place(a: PicturePose, b: PicturePose, t: number): void {
        picture.x = a.window.x + (b.window.x - a.window.x) * t;
        picture.y = a.window.y + (b.window.y - a.window.y) * t;
        picture.width = a.window.width + (b.window.width - a.window.width) * t;
        picture.height = a.window.height + (b.window.height - a.window.height) * t;
        picture.frameX = a.frame.x + (b.frame.x - a.frame.x) * t;
        picture.frameY = a.frame.y + (b.frame.y - a.frame.y) * t;
        picture.frameWidth = a.frame.width + (b.frame.width - a.frame.width) * t;
        picture.frameHeight = a.frame.height + (b.frame.height - a.frame.height) * t;
        picture.tilt = a.tilt + (b.tilt - a.tilt) * t;
        picture.border = a.border + (b.border - a.border) * t;
    }
}

// How long each part of the way out takes, in milliseconds. The way in's
// parts are the model's, in `../data`.

/** The entry's screen powering off. */
export const POWER_OFF_MS = 350;
/** On the way back: the polaroid coming forward, then floating back to its card; the page coming back; the cards developing. */
export const EMERGE_MS = 300;
export const FLOAT_BACK_DELAY_MS = 200;
export const FLOAT_BACK_MS = 600;
export const BACKDROP_OUT_MS = 450;
export const DEVELOP_MS = 700;
export const DEVELOP_STAGGER_MS = 300;
/** The whole way back, from the polaroid coming forward to the last card developed. */
export const RETURN_TOTAL_MS = Math.max(FLOAT_BACK_DELAY_MS + FLOAT_BACK_MS, DEVELOP_STAGGER_MS + DEVELOP_MS);
/** Each fade of the quiet way out, for a visitor who has asked for less motion. */
export const QUIET_FADE_MS = 250;
/** The share of a power-on or power-off spent as a line. */
export const POWER_LINE_SHARE = 0.35;
/** How long the beam is a line as the screen powers on, before the line opens out. */
export const POWER_ON_BEAM_MS = POWER_ON_MS * POWER_LINE_SHARE;
/** How long the beam lasts as the screen powers off, from the line to the dot going out. */
export const POWER_OFF_BEAM_MS = POWER_OFF_MS * (1 - POWER_LINE_SHARE);

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A record's fields, writable: the view model's own, which its interface shows read-only. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };

/** How quickly the picture held at the play area eases to the play area as it changes: the time it takes to go two thirds of the way. */
const GROWN_EASE_MS = 80;
/** How small the polaroid gets as it recedes into the dark. */
const RECEDED_SCALE = 0.05;
/** A tube's screen squashed to a line, as a share of its height. */
const LINE_SCALE = 0.006;
/** How bright the line is. */
const POWER_BRIGHTNESS = 3;
/** The glow is never thinner than this, in CSS pixels. */
const GLOW_MIN_HEIGHT = 3;
/** The share of the screen's opening over which the glow fades. */
const GLOW_FADE_SHARE = 0.4;

/**
 * When each card starts, in milliseconds after the phase does: in order of
 * distance from `centre`, spread over `staggerMs`. With no centre, all at once.
 */
function delaysFrom(cards: readonly Rect[], centre: { x: number; y: number } | undefined, staggerMs: number): number[] {
    const distances = cards.map((card) => (centre === undefined || card.width === 0
        ? 0
        : Math.hypot(card.x + card.width / 2 - centre.x, card.y + card.height / 2 - centre.y)));
    const furthest = Math.max(1, ...distances);
    return distances.map((distance) => (distance / furthest) * staggerMs);
}

function centreOf(rect: Rect): { x: number; y: number } {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function clamp01(t: number): number {
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Slow, fast, slow. */
function ease(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

/** Slow, then fast. */
function easeIn(t: number): number {
    return t * t * t;
}

/** Fast, then slow. */
function easeOut(t: number): number {
    return 1 - (1 - t) ** 3;
}
