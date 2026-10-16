import { createCommandQueue } from './command-queue';
import {
    COMMAND_STRIDE,
    ECHO_SETTING_INDEX,
    FILTER_SETTING_INDEX,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_PLAY_EFFECT,
    OP_RELEASE_ALL,
    OP_RESERVE_VOICES,
    OP_SET_ECHO,
    OP_SET_FILTER,
    OP_SET_MIX,
    OP_SET_VOICE,
    VOICE_COUNT,
    VOICE_SETTING_INDEX,
} from './commands';
import {
    type Character,
    DEFAULT_STEP_MS,
    type EffectData,
    FILTER_BANDPASS,
    FILTER_HIGHPASS,
    FILTER_LOWPASS,
    type InstrumentData,
    MAX_ARPEGGIO,
    type StepData,
    WAVE_NOISE,
    WAVE_PULSE,
    WAVE_SAW,
    WAVE_TABLE,
    WAVE_TRIANGLE,
    WAVETABLE_SIZE,
} from './instrument-data';
import { chooseEffectVoice, type EffectVoices } from './choose-effect-voice';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio80's synthesiser, which computes its sound. It has eight voices,
 * two filters, an echo and an output stage, mixed to one channel because the
 * chip is mono. A voice is a channel that plays one note at a time. It also
 * has a driver, which plays instruments and effects on the voices.
 *
 * It is plain TypeScript with no Web Audio in it, so it runs the same in an
 * audio worklet (code on the browser's audio thread) and in Node. It never
 * reads a clock. What it renders depends only on the commands it is given
 * and the samples asked for, so the same commands always render the same
 * samples.
 */
export interface Audio80Synthesiser {
    /** The rate it renders at, in samples a second. */
    readonly sampleRate: number;
    /** Makes an instrument playable by id. It runs once per instrument until the next `reset`, so it is not on a hot path. */
    defineInstrument: (id: number, data: InstrumentData) => void;
    /** Makes an effect playable by id. It runs once per effect until the next `reset`, so it is not on a hot path. */
    defineEffect: (id: number, data: EffectData) => void;
    /**
     * Queues `count` commands to apply at their stamps. Each command takes
     * `COMMAND_STRIDE` numbers. A command's stamp is the chip time it applies
     * at, in ms. The synthesiser copies the commands, so the caller can reuse
     * `commands` at once.
     *
     * A command that arrives while the queue is full is dropped. So is one
     * whose stamp is NaN or `+Infinity`, or whose operands are not all finite.
     */
    enqueue: (commands: Float64Array, count: number) => void;
    /**
     * Renders `frames` samples into `output`, starting at index `offset`. The
     * first sample is at chip time `fromMs`, and each sample is `msPerSample`
     * ms after the one before. Each queued command applies at the first
     * sample at or after its stamp. A command stamped at or before `fromMs`
     * applies at the first sample. So does one stamped `-Infinity`, which
     * means as soon as possible.
     */
    render: (output: Float32Array, offset: number, frames: number, fromMs: number, msPerSample: number) => void;
    /**
     * Cuts every voice, empties the queue, and forgets every instrument and
     * effect. It leaves the mix set by `setMix` as it is, because the mix is
     * the listener's volume setting, not part of what was playing.
     */
    reset: () => void;
    /**
     * Sets a bus's gain at once, without a ramp. A bus is a group of voices
     * mixed together, and its gain multiplies their volume. Use this for the
     * starting mix. Changes during play go through `OP_SET_MIX` commands.
     * Those ramp, moving the gain to its new value gradually.
     *
     * @param bus 0 for music, 1 for effects. Any other value is ignored.
     * @param gain 0 to 2, where 1 is as written. It is held to that range. A non-finite gain is ignored.
     */
    setMix: (bus: number, gain: number) => void;
    /** Whether voice `voice` is making a sound. */
    isSounding: (voice: number) => boolean;
    /** Finds the effect that voice `voice` is playing. Returns its id, or `undefined` if the voice is not playing one. */
    findEffectOn: (voice: number) => number | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an `Audio80Synthesiser`. */
export interface Audio80SynthesiserOptions {
    /** The rate to render at, in samples a second. */
    readonly sampleRate: number;
    /** How much grit survives the output stage. Defaults to `classic`. */
    readonly character?: Character;
    /** How many commands the queue holds. A command that arrives while it is full is dropped. Defaults to 4096. */
    readonly queueCapacity?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an Audio80's synthesiser. It starts silent, with every voice idle and the mix at 1. */
export function createAudio80Synthesiser(options: Audio80SynthesiserOptions): Audio80Synthesiser {
    const { sampleRate } = options;
    const character = options.character ?? 'classic';
    const isRaw = character === 'raw';
    const isQuantised = character === 'classic';
    const msPerAudioSample = 1000 / sampleRate;
    const echoDamping = adaptCoefficient(ECHO_DAMPING_AT_48K, sampleRate);
    const mixRamp = adaptCoefficient(MIX_RAMP_AT_48K, sampleRate);

    const instruments = new Map<number, InstrumentData>();
    const effects = new Map<number, EffectData>();

    // ---- Voices: one slot per voice in each array ---------------------------
    const phase = new Float64Array(VOICE_COUNT);
    const phaseInc = new Float64Array(VOICE_COUNT);
    const wave = new Int32Array(VOICE_COUNT);
    const pulseWidth = new Float64Array(VOICE_COUNT);
    const wavetable = new Float64Array(VOICE_COUNT * WAVETABLE_SIZE);
    const lfsr = new Int32Array(VOICE_COUNT);
    const noisePhase = new Float64Array(VOICE_COUNT);
    const noiseOut = new Float64Array(VOICE_COUNT);
    const noise12 = new Int32Array(VOICE_COUNT);
    const syncSource = new Int32Array(VOICE_COUNT);
    const ringSource = new Int32Array(VOICE_COUNT);
    const wrapped = new Uint8Array(VOICE_COUNT);

    const envStage = new Int32Array(VOICE_COUNT);
    const envLevel = new Float64Array(VOICE_COUNT);
    const attackInc = new Float64Array(VOICE_COUNT);
    const decayCoef = new Float64Array(VOICE_COUNT);
    const sustainLevel = new Float64Array(VOICE_COUNT);
    const releaseCoef = new Float64Array(VOICE_COUNT);

    const noteVolume = new Float64Array(VOICE_COUNT);
    const stepVolume = new Float64Array(VOICE_COUNT);
    const instrumentVolume = new Float64Array(VOICE_COUNT);
    const route = new Int32Array(VOICE_COUNT);
    const echoSend = new Float64Array(VOICE_COUNT);

    // The driver's state for each voice's note
    const voiceSteps: (readonly StepData[])[] = [];
    const stepMs = new Float64Array(VOICE_COUNT);
    const stepIndex = new Int32Array(VOICE_COUNT);
    const stepPitchMode = new Int32Array(VOICE_COUNT);
    const stepPitch = new Float64Array(VOICE_COUNT);
    const noteSamples = new Float64Array(VOICE_COUNT);
    const baseNote = new Float64Array(VOICE_COUNT);
    const previousNote = new Float64Array(VOICE_COUNT);
    const currentNote = new Float64Array(VOICE_COUNT);
    const arpeggio = new Float64Array(VOICE_COUNT * MAX_ARPEGGIO);
    const arpeggioLength = new Int32Array(VOICE_COUNT);
    const vibratoDepth = new Float64Array(VOICE_COUNT);
    const vibratoHz = new Float64Array(VOICE_COUNT);
    const vibratoDelayMs = new Float64Array(VOICE_COUNT);
    const slideRate = new Float64Array(VOICE_COUNT);
    const slideOffset = new Float64Array(VOICE_COUNT);
    const glideFrom = new Float64Array(VOICE_COUNT);
    const glideMs = new Float64Array(VOICE_COUNT);
    const glideElapsed = new Float64Array(VOICE_COUNT);
    const pulseSweepMs = new Float64Array(VOICE_COUNT);
    const pulseSweepFrom = new Float64Array(VOICE_COUNT);
    const pulseSweepTo = new Float64Array(VOICE_COUNT);
    const isPulseSweepPingPong = new Uint8Array(VOICE_COUNT);
    const filterSweepMs = new Float64Array(VOICE_COUNT);
    const filterSweepFrom = new Float64Array(VOICE_COUNT);
    const filterSweepTo = new Float64Array(VOICE_COUNT);

    // Which effect each voice plays. The voice allocator reads these
    const effectId = new Int32Array(VOICE_COUNT);
    const effectPriority = new Float64Array(VOICE_COUNT);
    const startedAt = new Float64Array(VOICE_COUNT);
    // Samples until an effect's note is released. It is 0 for a note with no set length
    const offCountdown = new Float64Array(VOICE_COUNT);
    const effectVoices: EffectVoices = { effectId, effectPriority, startedAt, isSounding: isVoiceSounding };
    let musicVoices = 0;

    // ---- Filters: two -------------------------------------------------------
    const filterMode = new Int32Array(FILTER_COUNT);
    const filterCutoff = new Float64Array(FILTER_COUNT);
    const filterResonance = new Float64Array(FILTER_COUNT);
    const filterDrive = new Float64Array(FILTER_COUNT);
    const filterK = new Float64Array(FILTER_COUNT);
    const filterA1 = new Float64Array(FILTER_COUNT);
    const filterA2 = new Float64Array(FILTER_COUNT);
    const filterA3 = new Float64Array(FILTER_COUNT);
    // Each filter's two integrator states (ic1, ic2): the values it carries
    // from one sample to the next
    const filterState = new Float64Array(FILTER_COUNT * 2);
    let areFiltersDirty = true;

    // ---- Echo ---------------------------------------------------------------
    const echoSize = Math.ceil(sampleRate * MAX_ECHO_MS / 1000) + 1;
    const echo = new Float32Array(echoSize);
    let echoWrite = 0;
    let echoDelay = 1;
    let echoFeedback = 0;
    let echoLevel = 0;

    // ---- The mix: music's voices and effects' voices, each with a gain -------
    // Each bus's target gain and current gain. The current gain moves a little
    // towards the target each sample, so a dragged slider does not click
    const mixTarget = new Float64Array([1, 1]);
    const mixGain = new Float64Array([1, 1]);

    // ---- Each sample's working values ----------------------------------------
    const voiceOut = new Float64Array(VOICE_COUNT);
    const bus = new Float64Array(BUS_COUNT);
    // The echo's damping state, and the DC blocker's last input and output.
    // The DC blocker removes any steady offset from zero in the output
    // (DC, short for direct current)
    const mix = new Float64Array(MIX_STATE_COUNT);

    // ---- The queue -----------------------------------------------------------
    const queue = createCommandQueue({ capacity: options.queueCapacity ?? DEFAULT_QUEUE_CAPACITY });
    const queued = queue.buffer;

    let controlCountdown = 0;
    let sampleClock = 0;

    resetAll();

    const synthesiser: Audio80Synthesiser = {
        sampleRate,

        defineInstrument(id, data) {
            instruments.set(id, data);
        },

        defineEffect(id, data) {
            effects.set(id, data);
        },

        enqueue(commands, count) {
            for (let i = 0; i < count; i++) queue.insert(commands, i * COMMAND_STRIDE);
        },

        render(output, offset, frames, fromMs, msPerSample) {
            let done = 0;
            for (;;) {
                // Apply every command due by sample `done`, and find when the next one is due
                let next = frames;
                for (let at = queue.head; at >= 0; at = queue.head) {
                    const due = toSampleIndex(queued[at + 1], fromMs, msPerSample);
                    if (due > done) {
                        if (due < next) next = due;
                        break;
                    }
                    apply(at);
                    queue.removeHead();
                }
                renderSamples(output, offset + done, next - done);
                done = next;
                if (done >= frames) break;
            }
        },

        reset() {
            instruments.clear();
            effects.clear();
            resetAll();
        },

        setMix(bus, gain) {
            if ((bus !== 0 && bus !== 1) || !Number.isFinite(gain)) return;
            mixTarget[bus] = mixGain[bus] = clampGain(gain);
        },

        isSounding(voice) {
            return isVoiceSounding(voice);
        },

        findEffectOn(voice) {
            if (!isVoiceSounding(voice) || effectId[voice] < 0) return undefined;
            return effectId[voice];
        },
    };

    return synthesiser;

    // ---- Commands -----------------------------------------------------------

    function apply(at: number): void {
        const op = queued[at];
        const a = queued[at + 2];
        const b = queued[at + 3];
        const c = queued[at + 4];
        const d = queued[at + 5];
        switch (op) {
            case OP_NOTE_ON: {
                const data = instruments.get(b);
                if (data !== undefined && isVoice(a)) startNote(a, data, c, d);
                break;
            }
            case OP_NOTE_OFF:
                if (isVoice(a)) release(a);
                break;
            case OP_SET_VOICE:
                if (isVoice(a)) setVoice(a, b, c);
                break;
            case OP_SET_FILTER:
                if (a === 0 || a === 1) setFilter(a, b, c);
                break;
            case OP_SET_ECHO:
                setEcho(a, b);
                break;
            case OP_PLAY_EFFECT:
                playEffect(a);
                break;
            case OP_RELEASE_ALL:
                for (let v = 0; v < VOICE_COUNT; v++) release(v);
                break;
            case OP_RESERVE_VOICES:
                musicVoices = Math.max(0, Math.min(VOICE_COUNT, Math.round(a)));
                break;
            case OP_SET_MIX:
                if (a === 0 || a === 1) mixTarget[a] = clampGain(b);
                break;
        }
    }

    function startNote(v: number, data: InstrumentData, note: number, volume: number): void {
        wave[v] = data.wave;
        pulseWidth[v] = data.pulseWidth;
        for (let i = 0; i < WAVETABLE_SIZE; i++) {
            wavetable[v * WAVETABLE_SIZE + i] = i < data.wavetable.length ? data.wavetable[i] : 0;
        }
        attackInc[v] = data.attackMs <= 0 ? 1 : msPerAudioSample / data.attackMs;
        decayCoef[v] = computeFallCoefficient(data.decayMs);
        sustainLevel[v] = data.sustain;
        releaseCoef[v] = computeFallCoefficient(data.releaseMs);
        instrumentVolume[v] = data.volume;
        route[v] = data.filter;
        echoSend[v] = data.echo;
        voiceSteps[v] = data.steps;
        stepMs[v] = data.stepMs;
        arpeggioLength[v] = Math.min(data.arpeggio.length, MAX_ARPEGGIO);
        for (let i = 0; i < arpeggioLength[v]; i++) arpeggio[v * MAX_ARPEGGIO + i] = data.arpeggio[i];
        vibratoDepth[v] = data.vibratoSemitones;
        vibratoHz[v] = data.vibratoHz;
        vibratoDelayMs[v] = data.vibratoDelayMs;
        pulseSweepMs[v] = data.pulseSweepMs;
        pulseSweepFrom[v] = data.pulseWidth;
        pulseSweepTo[v] = data.pulseSweepTo;
        isPulseSweepPingPong[v] = data.isPulseSweepPingPong ? 1 : 0;
        // The sweep moves evenly in pitch from one cutoff to the other. That needs both above 0 Hz
        const hasFilterSweep = data.filterSweepFromHz > 0 && data.filterSweepToHz > 0;
        filterSweepMs[v] = hasFilterSweep ? data.filterSweepMs : 0;
        filterSweepFrom[v] = data.filterSweepFromHz;
        filterSweepTo[v] = data.filterSweepToHz;
        syncSource[v] = toSourceVoice(v, data.syncSource);
        ringSource[v] = toSourceVoice(v, data.ringSource);

        previousNote[v] = currentNote[v];
        baseNote[v] = note;
        noteVolume[v] = volume;
        stepVolume[v] = 1;
        stepIndex[v] = -1;
        stepPitchMode[v] = PITCH_NONE;
        noteSamples[v] = 0;
        slideRate[v] = 0;
        slideOffset[v] = 0;
        glideMs[v] = 0;
        // The attack starts from the envelope's current level, so a note played
        // over another does not drop to silence first
        envStage[v] = ENV_ATTACK;
        effectId[v] = -1;
        effectPriority[v] = 0;
        offCountdown[v] = 0;
        startedAt[v] = sampleClock;
        controlVoice(v, 0);
    }

    function release(v: number): void {
        if (envStage[v] !== ENV_IDLE) envStage[v] = ENV_RELEASE;
    }

    function setVoice(v: number, setting: number, value: number): void {
        switch (setting) {
            case VOICE_SETTING_INDEX.note:
                baseNote[v] = value;
                glideMs[v] = 0;
                break;
            case VOICE_SETTING_INDEX.pulseWidth:
                pulseWidth[v] = clamp01(value);
                pulseSweepMs[v] = 0;
                break;
            case VOICE_SETTING_INDEX.volume:
                // Not capped at 1, so a song can lift a quiet instrument
                noteVolume[v] = Math.max(0, value);
                break;
            case VOICE_SETTING_INDEX.echoSend:
                echoSend[v] = clamp01(value);
                break;
            case VOICE_SETTING_INDEX.filter:
                route[v] = value === 1 || value === 2 ? value : 0;
                break;
            case VOICE_SETTING_INDEX.wave:
                wave[v] = value & (WAVE_TRIANGLE | WAVE_SAW | WAVE_PULSE | WAVE_NOISE | WAVE_TABLE);
                break;
            case VOICE_SETTING_INDEX.arpeggio:
                if (value <= 0) {
                    arpeggioLength[v] = 0;
                }
                else {
                    arpeggio[v * MAX_ARPEGGIO] = 0;
                    arpeggio[v * MAX_ARPEGGIO + 1] = Math.floor(value / 16);
                    arpeggio[v * MAX_ARPEGGIO + 2] = value % 16;
                    arpeggioLength[v] = 3;
                }
                break;
            case VOICE_SETTING_INDEX.vibratoDepth:
                vibratoDepth[v] = Math.max(0, value);
                vibratoDelayMs[v] = 0;
                break;
            case VOICE_SETTING_INDEX.vibratoRate:
                vibratoHz[v] = Math.max(0, value);
                break;
            case VOICE_SETTING_INDEX.slide:
                slideRate[v] = value;
                break;
            case VOICE_SETTING_INDEX.glide:
                glideFrom[v] = previousNote[v];
                glideMs[v] = Math.max(0, value);
                glideElapsed[v] = 0;
                break;
            case VOICE_SETTING_INDEX.syncSource:
                syncSource[v] = toSourceVoice(v, value);
                break;
            case VOICE_SETTING_INDEX.ringSource:
                ringSource[v] = toSourceVoice(v, value);
                break;
        }
    }

    function setFilter(f: number, setting: number, value: number): void {
        switch (setting) {
            case FILTER_SETTING_INDEX.mode:
                filterMode[f] = value & (FILTER_LOWPASS | FILTER_BANDPASS | FILTER_HIGHPASS);
                break;
            case FILTER_SETTING_INDEX.cutoffHz:
                setCutoff(f, value);
                break;
            case FILTER_SETTING_INDEX.resonance:
                filterResonance[f] = clamp01(value);
                areFiltersDirty = true;
                break;
            case FILTER_SETTING_INDEX.drive:
                filterDrive[f] = clamp01(value);
                break;
        }
    }

    function setEcho(setting: number, value: number): void {
        switch (setting) {
            case ECHO_SETTING_INDEX.timeMs:
                echoDelay = Math.max(1, Math.min(echoSize - 1, Math.round(value * sampleRate / 1000)));
                break;
            case ECHO_SETTING_INDEX.feedback:
                echoFeedback = Math.min(MAX_ECHO_FEEDBACK, Math.max(0, value));
                break;
            case ECHO_SETTING_INDEX.level:
                echoLevel = clamp01(value);
                break;
        }
    }

    function playEffect(id: number): void {
        const fx = effects.get(id);
        if (fx === undefined) return;
        const v = chooseEffectVoice(effectVoices, musicVoices, id, fx.priority, fx.maxVoices);
        if (v < 0) return;
        startNote(v, fx.instrument, fx.note, fx.volume);
        effectId[v] = id;
        effectPriority[v] = fx.priority;
        // At least one sample. A countdown of 0 means the note has no set length, so it would never be released
        offCountdown[v] = Math.max(1, fx.lengthMs / msPerAudioSample);
        if (!Number.isNaN(fx.glideTo)) {
            glideFrom[v] = fx.note;
            baseNote[v] = fx.glideTo;
            glideMs[v] = fx.lengthMs;
            glideElapsed[v] = 0;
            controlVoice(v, 0);
        }
    }

    // ---- The driver, at control rate ----------------------------------------

    function controlAll(): void {
        for (let v = 0; v < VOICE_COUNT; v++) controlVoice(v, CONTROL_SAMPLES);
        if (areFiltersDirty) updateFilterCoefficients();
        // With no input, the states of the filters, the echo and the DC
        // blocker shrink towards 0 without ever reaching it. Numbers that
        // small are called subnormal, and they make the processor's arithmetic
        // many times slower. Values this small are far too quiet to hear, so
        // set them to 0. The test is written so that a NaN fails it too, and
        // is cleared.
        for (let i = 0; i < filterState.length; i++) {
            if (!(Math.abs(filterState[i]) >= TINY)) filterState[i] = 0;
        }
        for (let i = 0; i < mix.length; i++) {
            if (!(Math.abs(mix[i]) >= TINY)) mix[i] = 0;
        }
    }

    /**
     * Moves voice `v`'s note on by `elapsed` samples. It advances the note's
     * steps, arpeggio, vibrato, slides and sweeps, then sets its pitch.
     */
    function controlVoice(v: number, elapsed: number): void {
        if (elapsed > 0) {
            noteSamples[v] += elapsed;
            const elapsedMs = elapsed * msPerAudioSample;
            slideOffset[v] += slideRate[v] * elapsedMs / 1000;
            if (glideMs[v] > 0) glideElapsed[v] += elapsedMs;
            if (offCountdown[v] > 0) {
                offCountdown[v] -= elapsed;
                if (offCountdown[v] <= 0) release(v);
            }
        }
        const tMs = noteSamples[v] * msPerAudioSample;
        const step = stepMs[v] > 0 ? stepMs[v] : DEFAULT_STEP_MS;

        const steps = voiceSteps[v];
        if (steps.length > 0) {
            const index = Math.min(Math.floor(tMs / step), steps.length - 1);
            if (index !== stepIndex[v]) {
                stepIndex[v] = index;
                applyStep(v, steps[index]);
            }
        }

        let note = baseNote[v];
        if (glideMs[v] > 0) {
            const u = glideElapsed[v] >= glideMs[v] ? 1 : glideElapsed[v] / glideMs[v];
            note = glideFrom[v] + (baseNote[v] - glideFrom[v]) * u;
        }
        if (stepPitchMode[v] === PITCH_RELATIVE) note += stepPitch[v];
        else if (stepPitchMode[v] === PITCH_ABSOLUTE) note = stepPitch[v];
        if (arpeggioLength[v] > 0) {
            note += arpeggio[v * MAX_ARPEGGIO + (Math.floor(tMs / step) % arpeggioLength[v])];
        }
        if (vibratoDepth[v] > 0 && tMs > vibratoDelayMs[v]) {
            note += vibratoDepth[v] * Math.sin(TWO_PI * vibratoHz[v] * (tMs - vibratoDelayMs[v]) / 1000);
        }
        note += slideOffset[v];
        currentNote[v] = note;
        // This is `toFrequency`, written out in place. V8 boxes a double (puts
        // it in a new heap object) when a call it does not inline returns one.
        // This line runs for every voice at control rate, which is once every
        // `CONTROL_SAMPLES` samples
        phaseInc[v] = 440 * Math.pow(2, (note - 69) / 12) / sampleRate;

        if (pulseSweepMs[v] > 0) {
            let u = tMs / pulseSweepMs[v];
            if (isPulseSweepPingPong[v] === 1) {
                u %= 2;
                if (u > 1) u = 2 - u;
            }
            else if (u > 1) {
                u = 1;
            }
            pulseWidth[v] = pulseSweepFrom[v] + (pulseSweepTo[v] - pulseSweepFrom[v]) * u;
        }

        // An idle voice leaves the filter alone: another voice may be using it
        if (filterSweepMs[v] > 0 && route[v] > 0 && envStage[v] !== ENV_IDLE) {
            const u = tMs >= filterSweepMs[v] ? 1 : tMs / filterSweepMs[v];
            setCutoff(route[v] - 1, filterSweepFrom[v] * Math.pow(filterSweepTo[v] / filterSweepFrom[v], u));
            if (u >= 1) filterSweepMs[v] = 0;
        }
    }

    function applyStep(v: number, step: StepData): void {
        if (step.wave >= 0) wave[v] = step.wave;
        if (step.pitchMode === 'relative') {
            stepPitchMode[v] = PITCH_RELATIVE;
            stepPitch[v] = step.pitch;
        }
        else if (step.pitchMode === 'absolute') {
            stepPitchMode[v] = PITCH_ABSOLUTE;
            stepPitch[v] = step.pitch;
        }
        if (step.volume >= 0) stepVolume[v] = step.volume;
        if (step.pulseWidth >= 0) {
            pulseWidth[v] = step.pulseWidth;
            pulseSweepMs[v] = 0;
        }
        // An idle voice leaves the filter alone: another voice may be using it
        if (step.cutoffHz >= 0 && route[v] > 0 && envStage[v] !== ENV_IDLE) setCutoff(route[v] - 1, step.cutoffHz);
    }

    // ---- Samples --------------------------------------------------------------

    function renderSamples(output: Float32Array, start: number, count: number): void {
        const end = start + count;
        for (let s = start; s < end; s++) {
            if (--controlCountdown <= 0) {
                controlAll();
                controlCountdown = CONTROL_SAMPLES;
            }

            // Advance every phase before applying sync, so a voice synced to a
            // higher-numbered voice sees that voice's wrap in the same sample
            for (let v = 0; v < VOICE_COUNT; v++) {
                let p = phase[v] + phaseInc[v];
                wrapped[v] = 0;
                if (p >= 1) {
                    p -= Math.floor(p);
                    wrapped[v] = 1;
                }
                phase[v] = p;
                if ((wave[v] & WAVE_NOISE) !== 0) clockNoise(v);
            }
            for (let v = 0; v < VOICE_COUNT; v++) {
                const source = syncSource[v];
                if (source >= 0 && wrapped[source] === 1) phase[v] = 0;
            }

            // The buses are summed in a typed array. V8 would box per-sample
            // doubles kept in closure variables or returned from functions
            for (let i = 0; i < BUS_COUNT; i++) bus[i] = 0;
            mixGain[0] += (mixTarget[0] - mixGain[0]) * mixRamp;
            mixGain[1] += (mixTarget[1] - mixGain[1]) * mixRamp;
            for (let v = 0; v < VOICE_COUNT; v++) {
                if (envStage[v] === ENV_IDLE) continue;
                stepEnvelope(v);
                oscillate(v);
                let x = voiceOut[v] * envLevel[v] * noteVolume[v] * stepVolume[v] * instrumentVolume[v] * VOICE_GAIN;
                // Rounded to 8-bit steps before the bus gain, so a low volume slider does not make raw voices coarser
                if (isRaw) x = Math.round(x * 127) / 127;
                // A voice is on the effects bus while it plays an effect, and on the music bus otherwise
                x *= mixGain[effectId[v] >= 0 ? 1 : 0];
                x *= MIX_LEVEL;
                bus[route[v]] += x;
                const send = echoSend[v];
                if (send > 0) bus[BUS_SEND] += x * send;
            }
            filterBus(0, BUS_A);
            filterBus(1, BUS_B);
            let out = bus[BUS_DRY] + bus[BUS_A] + bus[BUS_B];

            // The echo is a delay. Each repeat is darker than the one before
            let read = echoWrite - echoDelay;
            if (read < 0) read += echoSize;
            const echoed = echo[read];
            mix[ECHO_DAMP] += echoDamping * (echoed - mix[ECHO_DAMP]);
            echo[echoWrite] = bus[BUS_SEND] + mix[ECHO_DAMP] * echoFeedback;
            echoWrite = echoWrite + 1 === echoSize ? 0 : echoWrite + 1;
            out += echoed * echoLevel;

            // Remove any DC offset, then soft clip. Soft clipping rounds off a loud moment rather than cracking
            mix[DC_OUT] = out - mix[DC_IN] + DC_POLE * mix[DC_OUT];
            mix[DC_IN] = out;
            output[s] = Math.tanh(mix[DC_OUT]);
        }
        sampleClock += count;
    }

    function stepEnvelope(v: number): void {
        let level = envLevel[v];
        switch (envStage[v]) {
            case ENV_ATTACK:
                level += attackInc[v];
                if (level >= 1) {
                    level = 1;
                    envStage[v] = ENV_DECAY;
                }
                break;
            case ENV_DECAY: {
                const sustain = sustainLevel[v];
                level = sustain + (level - sustain) * decayCoef[v];
                if (level - sustain < ENV_FLOOR) {
                    level = sustain;
                    envStage[v] = ENV_SUSTAIN;
                }
                break;
            }
            case ENV_RELEASE:
                level *= releaseCoef[v];
                if (level < ENV_FLOOR) {
                    level = 0;
                    envStage[v] = ENV_IDLE;
                }
                break;
        }
        envLevel[v] = level;
    }

    /** Writes one sample of voice `v`'s oscillator, from -1 to 1, into `voiceOut[v]`. */
    function oscillate(v: number): void {
        const w = wave[v];
        const p = phase[v];
        if (w === WAVE_TABLE) {
            voiceOut[v] = wavetable[v * WAVETABLE_SIZE + ((p * WAVETABLE_SIZE) | 0)] / 7.5 - 1;
            return;
        }
        if (w === WAVE_NOISE) {
            voiceOut[v] = noiseOut[v];
            return;
        }

        // The triangle folds the phase at its midpoint. The phase's top bit
        // says which half of the cycle it is in. Ring modulation flips that
        // bit when the source voice's top bit is set
        let isTopBit = p >= 0.5;
        const ring = ringSource[v];
        if (ring >= 0 && phase[ring] >= 0.5) isTopBit = !isTopBit;
        const lower = p * 2 - (p >= 0.5 ? 1 : 0);
        const triangle = isTopBit ? 1 - lower : lower;

        if (!isRaw && (w === WAVE_TRIANGLE || w === WAVE_SAW || w === WAVE_PULSE)) {
            let x: number;
            if (w === WAVE_TRIANGLE) {
                x = triangle * 2 - 1;
            }
            else {
                // Band limited, so the wave's sharp jumps do not alias (add
                // harsh false tones). Each jump is smoothed over a sample either
                // side by a polynomial, a method called polyBLEP. `atWrap`
                // smooths the jump where the phase wraps. `atWidth` smooths the
                // pulse's jump at its width
                const dt = phaseInc[v];
                let atWrap = 0;
                if (p < dt) {
                    const t = p / dt;
                    atWrap = t + t - t * t - 1;
                }
                else if (p > 1 - dt) {
                    const t = (p - 1) / dt;
                    atWrap = t * t + t + t + 1;
                }
                if (w === WAVE_SAW) {
                    // Falls from 1 to -1 at the wrap
                    x = 2 * p - 1 - atWrap;
                }
                else {
                    // Rises from -1 to 1 at the wrap, and falls back to -1 at the
                    // width. In combined waves, the pulse is the other way up. It
                    // lets the other waves through from the width to the end of
                    // the cycle. A lone pulse sounds the same either way up
                    const width = pulseWidth[v];
                    let sinceWidth = p - width;
                    if (sinceWidth < 0) sinceWidth += 1;
                    let atWidth = 0;
                    if (sinceWidth < dt) {
                        const t = sinceWidth / dt;
                        atWidth = t + t - t * t - 1;
                    }
                    else if (sinceWidth > 1 - dt) {
                        const t = (sinceWidth - 1) / dt;
                        atWidth = t * t + t + t + 1;
                    }
                    x = (p < width ? 1 : -1) + atWrap - atWidth;
                }
            }
            voiceOut[v] = isQuantised ? Math.round(x * 2047) / 2047 : x;
            return;
        }

        // Combined waveforms, and every waveform in the raw character, are 12-bit values ANDed together
        let bits = 0xfff;
        if ((w & WAVE_TRIANGLE) !== 0) bits &= (triangle * 4095) | 0;
        if ((w & WAVE_SAW) !== 0) bits &= (p * 4095) | 0;
        if ((w & WAVE_PULSE) !== 0) bits &= p >= pulseWidth[v] ? 0xfff : 0;
        if ((w & WAVE_NOISE) !== 0) bits &= noise12[v];
        voiceOut[v] = bits / 2047.5 - 1;
    }

    /**
     * Steps voice `v`'s noise generator, a shift register that makes
     * pseudo-random bits. It steps 16 times per cycle of the voice's pitch,
     * so the noise has a pitch too.
     */
    function clockNoise(v: number): void {
        let n = noisePhase[v] + phaseInc[v] * NOISE_CLOCKS_PER_CYCLE;
        if (n < 1) {
            noisePhase[v] = n;
            return;
        }
        let r = lfsr[v];
        let clocks = 0;
        while (n >= 1 && clocks < NOISE_CLOCKS_PER_CYCLE) {
            const bit = ((r >> 22) ^ (r >> 17)) & 1;
            r = ((r << 1) | bit) & 0x7fffff;
            n -= 1;
            clocks++;
        }
        noisePhase[v] = n - Math.floor(n);
        lfsr[v] = r;
        // Eight bits gathered from across the register
        const out8 = (((r >> 22) & 1) << 7) | (((r >> 19) & 1) << 6) | (((r >> 16) & 1) << 5) | (((r >> 13) & 1) << 4)
            | (((r >> 10) & 1) << 3) | (((r >> 7) & 1) << 2) | (((r >> 4) & 1) << 1) | ((r >> 1) & 1);
        noise12[v] = out8 << 4;
        noiseOut[v] = out8 / 127.5 - 1;
    }

    /**
     * Runs filter `f` for one sample, in place on bus `at`. It is a
     * state-variable filter. Its input is driven (pushed into gentle
     * distortion) for a little growl.
     */
    function filterBus(f: number, at: number): void {
        const input = bus[at];
        const drive = filterDrive[f];
        const x = drive > 0 ? Math.tanh(input * (1 + 4 * drive)) / (1 + 2 * drive) : input;
        const state = f * 2;
        const ic1 = filterState[state];
        const ic2 = filterState[state + 1];
        const v3 = x - ic2;
        const v1 = filterA1[f] * ic1 + filterA2[f] * v3;
        const v2 = ic2 + filterA2[f] * ic1 + filterA3[f] * v3;
        filterState[state] = 2 * v1 - ic1;
        filterState[state + 1] = 2 * v2 - ic2;
        const mode = filterMode[f];
        let out = 0;
        if ((mode & FILTER_LOWPASS) !== 0) out += v2;
        if ((mode & FILTER_BANDPASS) !== 0) out += v1;
        if ((mode & FILTER_HIGHPASS) !== 0) out += x - filterK[f] * v1 - v2;
        bus[at] = out;
    }

    // ---- Settings -----------------------------------------------------------

    function setCutoff(f: number, hz: number): void {
        const limited = Math.max(MIN_CUTOFF_HZ, Math.min(hz, sampleRate * MAX_CUTOFF_SHARE));
        if (limited === filterCutoff[f]) return;
        filterCutoff[f] = limited;
        areFiltersDirty = true;
    }

    function updateFilterCoefficients(): void {
        for (let f = 0; f < FILTER_COUNT; f++) {
            const g = Math.tan(Math.PI * filterCutoff[f] / sampleRate);
            const k = 2 - 1.98 * filterResonance[f];
            const a1 = 1 / (1 + g * (g + k));
            filterK[f] = k;
            filterA1[f] = a1;
            filterA2[f] = g * a1;
            filterA3[f] = g * g * a1;
        }
        areFiltersDirty = false;
    }

    function isVoiceSounding(v: number): boolean {
        const stage = envStage[v];
        if (stage === ENV_IDLE) return false;
        return stage === ENV_ATTACK || envLevel[v] > SILENT_LEVEL;
    }

    /** The per-sample factor that makes a level fall 60 dB over `ms`, or 0 for an instant fall. */
    function computeFallCoefficient(ms: number): number {
        return ms <= 0 ? 0 : Math.exp(LN_FALL / (ms / msPerAudioSample));
    }

    function resetAll(): void {
        for (let v = 0; v < VOICE_COUNT; v++) {
            phase[v] = 0;
            phaseInc[v] = 0;
            wave[v] = WAVE_PULSE;
            pulseWidth[v] = 0.5;
            lfsr[v] = LFSR_SEED;
            noisePhase[v] = 0;
            noiseOut[v] = 0;
            noise12[v] = 0;
            syncSource[v] = -1;
            ringSource[v] = -1;
            envStage[v] = ENV_IDLE;
            envLevel[v] = 0;
            attackInc[v] = 1;
            decayCoef[v] = 0;
            sustainLevel[v] = 1;
            releaseCoef[v] = 0;
            noteVolume[v] = 1;
            stepVolume[v] = 1;
            instrumentVolume[v] = 1;
            route[v] = 0;
            echoSend[v] = 0;
            voiceSteps[v] = NO_STEPS;
            stepMs[v] = DEFAULT_STEP_MS;
            stepIndex[v] = -1;
            stepPitchMode[v] = PITCH_NONE;
            noteSamples[v] = 0;
            baseNote[v] = 60;
            previousNote[v] = 60;
            currentNote[v] = 60;
            arpeggioLength[v] = 0;
            vibratoDepth[v] = 0;
            slideRate[v] = 0;
            slideOffset[v] = 0;
            glideMs[v] = 0;
            pulseSweepMs[v] = 0;
            filterSweepMs[v] = 0;
            effectId[v] = -1;
            effectPriority[v] = 0;
            startedAt[v] = 0;
            offCountdown[v] = 0;
        }
        wavetable.fill(0);
        musicVoices = 0;
        for (let f = 0; f < FILTER_COUNT; f++) {
            filterMode[f] = FILTER_LOWPASS;
            filterCutoff[f] = DEFAULT_CUTOFF_HZ;
            filterResonance[f] = 0;
            filterDrive[f] = 0;
        }
        filterState.fill(0);
        updateFilterCoefficients();
        echo.fill(0);
        echoWrite = 0;
        setEcho(ECHO_SETTING_INDEX.timeMs, DEFAULT_ECHO_MS);
        echoFeedback = DEFAULT_ECHO_FEEDBACK;
        echoLevel = DEFAULT_ECHO_LEVEL;
        mix.fill(0);
        queue.clear();
        controlCountdown = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Samples between the driver's updates of pitch, sweeps and steps: about 0.7 ms at 48 kHz. */
const CONTROL_SAMPLES = 32;
/** Each voice's share of full scale, before `MIX_LEVEL`. */
const VOICE_GAIN = 0.3;
/**
 * Every voice's level into the mix, after its bus gain. It is 3 dB down
 * (1 / √2). With `VOICE_GAIN`, it leaves four voices at full volume a little
 * under full scale. It is applied separately from `VOICE_GAIN`, after the raw
 * character's rounding, so the rounding's steps stay where they are.
 */
const MIX_LEVEL = Math.SQRT1_2;
const NOISE_CLOCKS_PER_CYCLE = 16;
const LFSR_SEED = 0x7ffff8;
const DEFAULT_QUEUE_CAPACITY = 4096;

const ENV_IDLE = 0;
const ENV_ATTACK = 1;
const ENV_DECAY = 2;
const ENV_SUSTAIN = 3;
const ENV_RELEASE = 4;
/** The envelope ends its decay this close to the sustain level, and its release this close to 0 (80 dB down). */
const ENV_FLOOR = 1e-4;
/** Below this envelope level, a voice counts as silent and is free for an effect. */
const SILENT_LEVEL = 1e-3;
/** Decay and release fall 60 dB over their time. */
const LN_FALL = Math.log(1e-3);

const PITCH_NONE = 0;
const PITCH_RELATIVE = 1;
const PITCH_ABSOLUTE = 2;

const FILTER_COUNT = 2;
const MIN_CUTOFF_HZ = 20;
/** The highest cutoff, as a share of the sample rate. It is kept below half, where the filter stops working. */
const MAX_CUTOFF_SHARE = 0.45;
const DEFAULT_CUTOFF_HZ = 2000;
const MAX_ECHO_MS = 1000;
const MAX_ECHO_FEEDBACK = 0.95;
const DEFAULT_ECHO_MS = 300;
const DEFAULT_ECHO_FEEDBACK = 0.35;
const DEFAULT_ECHO_LEVEL = 0.5;
const DC_POLE = 0.9995;
/** The highest gain a bus can have, which plays it twice as loud as written. */
const MAX_MIX_GAIN = 2;
const TWO_PI = Math.PI * 2;
/** Below this size, a filter, echo or DC blocker state is set to 0, before it can become subnormal. */
const TINY = 1e-20;

/** The sample rate the per-sample coefficients below were tuned at. */
const REFERENCE_SAMPLE_RATE = 48000;
/**
 * How far the echo's damping moves towards each repeat per sample, at
 * 48 kHz. It works as a simple (one-pole) low-pass filter at about 3.3 kHz,
 * which darkens each repeat.
 */
const ECHO_DAMPING_AT_48K = 0.35;
/**
 * How far a bus's gain moves towards its target per sample, at 48 kHz. It
 * gets 90% of the way to its target in about 10 ms.
 */
const MIX_RAMP_AT_48K = 0.005;

const NO_STEPS: readonly StepData[] = [];

// Each sample's buses. A voice's bus is its route: 0 for no filter, 1 for filter a, 2 for filter b
const BUS_DRY = 0;
const BUS_A = 1;
const BUS_B = 2;
const BUS_SEND = 3;
const BUS_COUNT = 4;

// Slots of the mixer's state
const ECHO_DAMP = 0;
const DC_IN = 1;
const DC_OUT = 2;
const MIX_STATE_COUNT = 3;

/** The index of the sample in the block at which a command stamped `stamp` applies. */
function toSampleIndex(stamp: number, fromMs: number, msPerSample: number): number {
    if (stamp <= fromMs) return 0;
    return Math.ceil((stamp - fromMs) / msPerSample - 1e-9);
}

/**
 * Converts a smoothing coefficient tuned at 48 kHz to one for `sampleRate`.
 * The result moves as fast in time as `atReference` does at 48 kHz. At
 * 48 kHz it returns `atReference` unchanged, so renders there stay exactly
 * the same, bit for bit.
 */
function adaptCoefficient(atReference: number, sampleRate: number): number {
    if (sampleRate === REFERENCE_SAMPLE_RATE) return atReference;
    return 1 - Math.pow(1 - atReference, REFERENCE_SAMPLE_RATE / sampleRate);
}

function isVoice(v: number): boolean {
    return v >= 0 && v < VOICE_COUNT && v === Math.floor(v);
}

/** Voice `source` as voice `v`'s sync or ring source, or -1 if it is not another voice on the chip. */
function toSourceVoice(v: number, source: number): number {
    return source >= 0 && source < VOICE_COUNT && source !== v ? Math.floor(source) : -1;
}

function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

function clampGain(value: number): number {
    return value < 0 ? 0 : value > MAX_MIX_GAIN ? MAX_MIX_GAIN : value;
}
