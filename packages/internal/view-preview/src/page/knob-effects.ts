import type { KnobKind, KnobValue, PoseInfo } from '../shared';
import { setActiveKnobs } from './knobs';
import type { CapturedImage, PreviewStage } from './preview-stage';
import { collectTuningReads, fieldKey, overrideField, readField, type RegisteredTuning } from './tunings';
import type { RecordedTest } from './vsnap-stand-in';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * What a knob does to the pose being previewed, which decides whether the
 * panels show it or fold it away.
 *
 * - `changes`: setting it lower or higher changes the picture, by `share`
 *   of its pixels at most, from 0 to 1.
 * - `same`: the pose reads it, but the picture stays the same either way.
 * - `unread`: the pose never reads it. Only a tuning field can be unread.
 * - `later`: the pose never read it, but the view has since, as it played.
 * - `unchecked`: the pose reads it, but the preview couldn't check what it
 *   changes, such as for a string, or a view whose pixels it can't read.
 */
export type KnobEffect =
    | { readonly kind: 'changes'; readonly share: number }
    | { readonly kind: 'same' }
    | { readonly kind: 'unread' }
    | { readonly kind: 'later' }
    | { readonly kind: 'unchecked' };

/** What each knob of a pose does to it. */
export interface KnobEffects {
    /** The pose's own knobs, by their index. */
    readonly pose: ReadonlyMap<number, KnobEffect>;
    /** The tuning fields, by their key (see `fieldKey`). */
    readonly tuning: ReadonlyMap<string, KnobEffect>;
    /** The keys of the tuning fields that the pose reads. */
    readonly poseReads: ReadonlySet<string>;
    /** Why the effects couldn't be measured, if they couldn't. */
    readonly note: string | undefined;
}

export interface MeasureKnobEffectsOptions {
    readonly stage: PreviewStage;
    readonly test: RecordedTest;
    /** The test's pose's knobs, or `undefined` for a pose defined elsewhere. */
    readonly pose: PoseInfo | undefined;
    /** The knobs you've changed on the pose, which the measurement starts from. */
    readonly poseValues: ReadonlyMap<number, KnobValue>;
    /** The tuning objects the test imports. */
    readonly tunings: readonly RegisteredTuning[];
    /** Called after each capture, with how many are done and how many there are. */
    readonly onProgress: (done: number, total: number) => void;
    /** Checked between captures. Once it returns true, the measurement stops and returns `undefined`. */
    readonly isCancelled: () => boolean;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Measures what each knob does to a pose, as it is now. It runs the pose
 * once, noting which tuning fields it reads, and once more to check that it
 * draws the same picture each time. Then, for each knob the pose reads, it
 * runs the pose with the knob set lower and higher, and compares the
 * pictures. Each value is put back afterwards, even if the measurement
 * stops part way.
 */
export async function measureKnobEffects(options: MeasureKnobEffectsOptions): Promise<KnobEffects | undefined> {
    const { stage, test, pose, poseValues, tunings, onProgress, isCancelled } = options;
    const usePoseValues = (values: ReadonlyMap<number, KnobValue>): void => setActiveKnobs(pose === undefined ? undefined : { poseId: pose.id, values });
    usePoseValues(poseValues);
    collectTuningReads();
    const baseline = await stage.capture(test);
    const poseReads = collectTuningReads();
    const fields = tunings.flatMap((registered) => registered.info.fields.map((field) => ({ registered, field, key: fieldKey(registered.info, field) })));
    const poseKnobs = pose?.knobs ?? [];

    const poseEffects = new Map<number, KnobEffect>();
    const tuningEffects = new Map<string, KnobEffect>();
    for (const { key } of fields) {
        if (!poseReads.has(key)) tuningEffects.set(key, { kind: 'unread' });
    }
    const markRestUnchecked = (note: string): KnobEffects => {
        for (const knob of poseKnobs) poseEffects.set(knob.index, { kind: 'unchecked' });
        for (const { key } of fields) {
            if (!tuningEffects.has(key)) tuningEffects.set(key, { kind: 'unchecked' });
        }
        return { pose: poseEffects, tuning: tuningEffects, poseReads, note };
    };
    if (baseline === undefined) return markRestUnchecked('The preview can\'t read this kind of view\'s pixels, so it shows every knob the pose reads.');
    const again = await stage.capture(test);
    collectTuningReads();
    if (again === undefined || measureChange(baseline, again) > 0) {
        return markRestUnchecked('This pose draws a different picture each time it runs, so the preview can\'t tell which knobs change it. Give its models a seed.');
    }

    // Each knob to try, with the values to try it at, and how to set and put back a value
    const trials: Trial[] = [];
    for (const knob of poseKnobs) {
        const value = poseValues.get(knob.index) ?? knob.value;
        trials.push({
            kind: knob.kind,
            label: knob.label,
            value,
            record: (effect) => poseEffects.set(knob.index, effect),
            apply: (tried) => {
                usePoseValues(new Map(poseValues).set(knob.index, tried));
                return () => usePoseValues(poseValues);
            },
        });
    }
    for (const { registered, field, key } of fields) {
        if (!poseReads.has(key)) continue;
        trials.push({
            kind: field.kind,
            label: field.path[field.path.length - 1],
            value: readField(registered, field),
            record: (effect) => tuningEffects.set(key, effect),
            apply: (tried) => overrideField({ registered, field, value: tried }),
        });
    }

    const total = trials.reduce((sum, trial) => sum + listTrialValues(trial).length, 0);
    let done = 0;
    for (const trial of trials) {
        const values = listTrialValues(trial);
        if (values.length === 0) {
            trial.record({ kind: 'unchecked' });
            continue;
        }
        let share = 0;
        for (const tried of values) {
            if (isCancelled()) {
                usePoseValues(poseValues);
                return undefined;
            }
            const restore = trial.apply(tried);
            try {
                const image = await stage.capture(test);
                share = Math.max(share, image === undefined ? 0 : measureChange(baseline, image));
            }
            catch {
                // A value the pose can't run with changes it as much as anything can
                share = 1;
            }
            finally {
                restore();
                collectTuningReads();
            }
            onProgress(++done, total);
        }
        trial.record(share > 0 ? { kind: 'changes', share } : { kind: 'same' });
    }
    usePoseValues(poseValues);
    return { pose: poseEffects, tuning: tuningEffects, poseReads, note: undefined };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface Trial {
    readonly kind: KnobKind;
    readonly label: string;
    readonly value: KnobValue;
    readonly record: (effect: KnobEffect) => void;
    /** Sets the knob to a value, and returns how to put it back. */
    readonly apply: (value: KnobValue) => () => void;
}

/**
 * Returns the values to try a knob at. A number is tried at half and one
 * and a half times, a boolean at its other value, and a colour at its
 * opposite. A
 * whole number stays whole, and a fraction, such as a `Chance`, stays from 0
 * to 1. A string isn't tried, since another string may be one the code
 * doesn't expect.
 */
function listTrialValues(trial: Trial): readonly KnobValue[] {
    const { kind, label, value } = trial;
    if (kind === 'boolean') return [!(value as boolean)];
    if (kind === 'color') return [(value as number) ^ 0xffffff];
    if (kind === 'string') return [];
    const number = value as number;
    if (number === 0) return [1];
    const isFraction = /(Chance|Fraction|Alpha)$/.test(label);
    const values: number[] = [];
    for (const factor of [0.5, 1.5]) {
        let tried = number * factor;
        if (Number.isInteger(number)) {
            tried = Math.round(tried);
            if (tried === number) tried = number + (factor < 1 ? -1 : 1);
        }
        if (isFraction) tried = Math.min(1, Math.max(0, tried));
        if (tried !== number && !values.includes(tried)) values.push(tried);
    }
    return values;
}

/** Returns the share of the pixels that differ between two pictures, from 0 to 1. Pictures of different sizes differ entirely. */
function measureChange(a: CapturedImage, b: CapturedImage): number {
    if (a.width !== b.width || a.height !== b.height) return 1;
    const count = a.width * a.height;
    let changed = 0;
    for (let i = 0; i < count; i++) {
        const at = i * 4;
        if (a.pixels[at] !== b.pixels[at] || a.pixels[at + 1] !== b.pixels[at + 1] || a.pixels[at + 2] !== b.pixels[at + 2] || a.pixels[at + 3] !== b.pixels[at + 3]) changed++;
    }
    return count === 0 ? 0 : changed / count;
}
