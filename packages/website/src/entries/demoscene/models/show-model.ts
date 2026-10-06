import { BEATS_PER_BAR, MS_PER_BAR, MS_PER_BEAT, type PartKind, SHOW_SCRIPT } from '../data';
import { type BootModel, createBootModel } from './boot-model';
import { createCreditsModel, type CreditsModel } from './credits-model';
import { createIntroModel, type IntroModel } from './intro-model';
import { createLogoPartModel, type LogoPartModel } from './logo-part-model';
import { createPlasmaPartModel, type PlasmaPartModel } from './plasma-part-model';
import { fadeInOut, wrap } from './show-math';
import { createSpritesPartModel, type SpritesPartModel } from './sprites-part-model';
import { createVectorsPartModel, type VectorsPartModel } from './vectors-part-model';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The whole show: a clock, the script of parts it plays, and a model per
 * part saying what is where.
 *
 * Every value it exposes, here and in the part models, is a function of
 * `timeMs` alone. Nothing accumulates from frame to frame, so `seek` is as
 * good as playing to the same time, and costs nothing. Leap-safe.
 */
export interface ShowModel {
    /** Milliseconds since the show began, wrapping at the end of the loop. */
    readonly timeMs: number;
    /** How long the show plays before it loops. */
    readonly loopMs: number;
    /** Fractional beats since the show began. */
    readonly beat: number;
    /** 1 on each bar's first beat, falling to 0 by its second. */
    readonly barFlash: number;

    readonly part: PartKind;
    /** The part's place in `SHOW_SCRIPT`. */
    readonly partIndex: number;
    readonly partElapsedMs: number;
    readonly partDurationMs: number;
    /** 0 at the part's start, 1 at its end. */
    readonly partProgress: number;
    /** The whole screen's brightness: 0 (black) at every change of part, 1 between. */
    readonly brightness: number;

    readonly boot: BootModel;
    readonly intro: IntroModel;
    readonly logo: LogoPartModel;
    readonly plasma: PlasmaPartModel;
    readonly vectors: VectorsPartModel;
    readonly sprites: SpritesPartModel;
    readonly credits: CreditsModel;

    /** Jumps to any time in the show, wrapping into the loop. */
    seek: (timeMs: number) => void;
    /** Jumps to the start of the part `count` parts on (or back, if negative), wrapping round the show. */
    skipParts: (count: number) => void;
    update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ShowModelOptions {
    /** Where the show starts, in milliseconds. Default 0. */
    readonly startMs?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createShowModel(options: ShowModelOptions = {}): ShowModel {
    const partStartsMs: number[] = [];
    const partDurationsMs: number[] = [];
    let loopMs = 0;
    for (let i = 0; i < SHOW_SCRIPT.length; i++) {
        partStartsMs.push(loopMs);
        partDurationsMs.push(SHOW_SCRIPT[i].bars * MS_PER_BAR);
        loopMs += partDurationsMs[i];
    }

    const bootIndex = indexOfPart('boot');
    const introIndex = indexOfPart('intro');
    const logoIndex = indexOfPart('logo');
    const plasmaIndex = indexOfPart('plasma');
    const vectorsIndex = indexOfPart('vectors');
    const spritesIndex = indexOfPart('sprites');
    const creditsIndex = indexOfPart('credits');

    let timeMs = 0;
    let partIndex = 0;
    seek(options.startMs ?? 0);

    const model: ShowModel = {
        get timeMs() { return timeMs; },
        loopMs,
        get beat() { return timeMs / MS_PER_BEAT; },
        get barFlash() {
            const beatInBar = wrap(timeMs / MS_PER_BEAT, BEATS_PER_BAR);
            return beatInBar < 1 ? 1 - beatInBar : 0;
        },
        get part() { return SHOW_SCRIPT[partIndex].part; },
        get partIndex() { return partIndex; },
        get partElapsedMs() { return timeMs - partStartsMs[partIndex]; },
        get partDurationMs() { return partDurationsMs[partIndex]; },
        get partProgress() { return (timeMs - partStartsMs[partIndex]) / partDurationsMs[partIndex]; },
        get brightness() {
            return fadeInOut(timeMs - partStartsMs[partIndex], partDurationsMs[partIndex], FADE_MS);
        },

        boot: createBootModel({ elapsedMs: () => elapsedIn(bootIndex) }),
        intro: createIntroModel({ elapsedMs: () => elapsedIn(introIndex) }),
        logo: createLogoPartModel({ elapsedMs: () => elapsedIn(logoIndex) }),
        plasma: createPlasmaPartModel({ elapsedMs: () => elapsedIn(plasmaIndex) }),
        vectors: createVectorsPartModel({ elapsedMs: () => elapsedIn(vectorsIndex) }),
        sprites: createSpritesPartModel({ elapsedMs: () => elapsedIn(spritesIndex) }),
        credits: createCreditsModel({
            elapsedMs: () => elapsedIn(creditsIndex),
            durationMs: partDurationsMs[creditsIndex],
            msPerBar: MS_PER_BAR,
        }),

        seek,
        skipParts(count) {
            const index = wrap(partIndex + count, SHOW_SCRIPT.length);
            seek(partStartsMs[index]);
        },
        update(deltaMs) {
            seek(timeMs + deltaMs);
        },
    };

    return model;

    function seek(toMs: number): void {
        timeMs = wrap(toMs, loopMs);
        partIndex = 0;
        while (partIndex < SHOW_SCRIPT.length - 1 && timeMs >= partStartsMs[partIndex + 1]) partIndex++;
    }

    /** Milliseconds into the part at `index`, held at its ends while another part plays. */
    function elapsedIn(index: number): number {
        const elapsed = timeMs - partStartsMs[index];
        return elapsed < 0 ? 0 : elapsed > partDurationsMs[index] ? partDurationsMs[index] : elapsed;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each part fades in over its first beat and out over its last. */
const FADE_MS = MS_PER_BEAT;

function indexOfPart(part: PartKind): number {
    for (let i = 0; i < SHOW_SCRIPT.length; i++) {
        if (SHOW_SCRIPT[i].part === part) return i;
    }
    throw new Error(`no part "${part}" in the script`);
}
