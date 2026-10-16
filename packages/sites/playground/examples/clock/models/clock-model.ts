// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The time on a 12-hour clock, in hours, minutes and seconds. It knows
 * nothing of angles or pixels. The view turns the time into those.
 */
export interface ClockModel {
    /** From 0 up to 12, with a fraction for the minutes passed. */
    readonly hours: number;
    /** From 0 up to 60, with a fraction for the seconds passed. */
    readonly minutes: number;
    /** From 0 up to 60, with a fraction for the ms passed. */
    readonly seconds: number;
    readonly update: (deltaMs: number) => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates a clock at 12 o'clock, which runs as time is given to it. */
export function createClockModel(): ClockModel {
    let elapsedMs = 0;

    const model: ClockModel = {
        get hours() { return (elapsedMs / MS_PER_HOUR) % HOURS_PER_CYCLE; },
        get minutes() { return (elapsedMs / MS_PER_MINUTE) % MINUTES_PER_HOUR; },
        get seconds() { return (elapsedMs / MS_PER_SECOND) % SECONDS_PER_MINUTE; },
        update(deltaMs) {
            elapsedMs += deltaMs;
        },
    };

    return model;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_CYCLE = 12;
const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
