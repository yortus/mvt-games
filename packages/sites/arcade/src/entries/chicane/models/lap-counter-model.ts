// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Keeps a race's clock and counts its laps. A lap counts when the car
 * crosses the start line going forward, after going round the far side of
 * the track since it last crossed. So backing over the line and driving
 * over it again doesn't count. The race is over once the last lap is
 * counted. The best lap is kept from race to race.
 *
 * The car's place reaches it only as the track sample the car is nearest,
 * which the game passes in each step.
 */
export interface LapCounterModel {
    /** How long the race has run, in milliseconds. It stops at the finish. */
    readonly raceTimeMs: number;
    /** The lap the car is on, from 1, or the last lap once the race is over. */
    readonly lap: number;
    /** How long the lap the car is on has taken so far, in milliseconds. */
    readonly lapTimeMs: number;
    /** The times of the laps finished this race, in milliseconds. */
    readonly lapTimesMs: readonly number[];
    /** Whether the last lap has been counted. */
    readonly isFinished: boolean;
    /** The fastest lap of any race so far, in milliseconds, if one has been finished. */
    readonly bestLapMs: number | undefined;
    /** How many laps finished so far set a new best lap. */
    readonly bestLapsSet: number;
    /**
     * Moves the race's clock on by `stepMs`, in which the car went from
     * track sample `fromSample` to `toSample`, and counts a lap if that
     * crossed the line. Once the race is over, the clock stays stopped.
     */
    readonly step: (stepMs: number, fromSample: number, toSample: number) => void;
    /** Starts a new race on lap 1, with the clock back at 0. It keeps the best lap. */
    readonly startNewRace: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LapCounterModelOptions {
    /** How many samples the track has, from the start line, round to just before it. */
    readonly sampleCount: number;
    /** How many laps a race has. */
    readonly laps: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a lap counter, on lap 1 of its first race. */
export function createLapCounterModel(options: LapCounterModelOptions): LapCounterModel {
    const { sampleCount, laps } = options;
    let raceTimeMs = 0;
    let lapStartMs = 0;
    let lap = 1;
    let lapTimesMs: number[] = [];
    let bestLapMs: number | undefined;
    let bestLapsSet = 0;
    // Whether the car has been round the far side of the track this lap, so crossing the line counts
    let isPastHalfway = false;

    return {
        get raceTimeMs() {
            return raceTimeMs;
        },
        get lap() {
            return lap;
        },
        get lapTimeMs() {
            return raceTimeMs - lapStartMs;
        },
        get lapTimesMs() {
            return lapTimesMs;
        },
        get isFinished() {
            return lapTimesMs.length === laps;
        },
        get bestLapMs() {
            return bestLapMs;
        },
        get bestLapsSet() {
            return bestLapsSet;
        },
        step(stepMs, fromSample, toSample) {
            if (lapTimesMs.length === laps) return;
            raceTimeMs += stepMs;
            if (toSample > sampleCount * 0.4 && toSample < sampleCount * 0.6) isPastHalfway = true;
            const crossedForward = fromSample > sampleCount * 0.75 && toSample < sampleCount * 0.25;
            if (!crossedForward || !isPastHalfway) return;
            isPastHalfway = false;
            const lapMs = raceTimeMs - lapStartMs;
            lapTimesMs.push(lapMs);
            lapStartMs = raceTimeMs;
            if (bestLapMs === undefined || lapMs < bestLapMs) {
                bestLapMs = lapMs;
                bestLapsSet++;
            }
            if (lapTimesMs.length < laps) lap++;
        },
        startNewRace() {
            raceTimeMs = 0;
            lapStartMs = 0;
            lap = 1;
            lapTimesMs = [];
            isPastHalfway = false;
        },
    };
}
