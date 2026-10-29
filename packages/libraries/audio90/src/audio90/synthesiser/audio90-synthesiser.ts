import {
    clamp,
    clearTinyValues,
    computeFall,
    CONTROL_SAMPLES,
    createCommandScheduler,
    createEnvelopes,
    createNoteDriver,
    createSoundPlays,
    DC_POLE,
    ENV_IDLE,
    ENV_RELEASE,
    LN_SEMITONE,
    MAX_CUTOFF_SHARE,
    MAX_ECHO_FEEDBACK,
    MIN_CUTOFF_HZ,
    OP_NOTE_OFF,
    OP_NOTE_ON,
    OP_PLAY,
    OP_PLAY_OPTIONS,
    OP_RELEASE_ALL,
    OP_SET_VOICE,
    OP_STOP,
    polyBlep,
    SCOPE_POINTS,
    SCOPE_STRIDE,
    SVF_A1,
    SVF_A2,
    SVF_A3,
    SVF_K,
    SVF_STRIDE,
    TINY,
    tuneStateVariableFilter,
} from '../../shared';
import {
    AUDIO90_CHARACTERS,
    AUDIO90_EFFECT_INDEX,
    AUDIO90_EFFECT_SETTING_INDEX,
    AUDIO90_VOICE_COUNT,
    AUDIO90_VOICE_SETTING_INDEX,
    type Audio90Character,
    type Audio90EffectId,
    type Audio90EffectSetting,
    OP90_SET_CHARACTER,
    OP90_SET_EFFECT,
    OP90_SET_TEMPO,
} from './commands';
import {
    type Audio90SoundData,
    type Audio90SampleData,
    type Audio90StepData,
    ENGINE_ANALOG,
    ENGINE_FM,
    ENGINE_SAMPLE,
    FILTER90_BANDPASS,
    FILTER90_LOWPASS_12,
    FILTER90_LOWPASS_24,
    FILTER90_NONE,
    LFO_RANDOM,
    LFO_SAW,
    LFO_SQUARE,
    LFO_TRIANGLE,
    MAX_OPERATORS,
    MAX_UNISON,
    WAVE90_PULSE,
    WAVE90_SAW,
    WAVE90_TRIANGLE,
} from './sound-data';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The Audio90's synthesiser, which computes its sound. It has sixteen
 * voices, in stereo. Each voice plays one of three engines: FM (four
 * operators), analog (up to seven copies of an oscillator, with a second
 * oscillator, a sub oscillator and noise), or a sample. Each voice has its own
 * filter, a volume envelope, a mod envelope and an LFO, and the note driver
 * that the Audio80 uses. A chorus, an echo and a reverb take a send from every
 * voice, and a pump can duck the music in time with one voice's notes.
 *
 * It is plain TypeScript with no Web Audio in it, so it runs the same in an
 * audio worklet and in Node. It never reads a clock. What it renders depends
 * only on the commands it is given and the samples asked for.
 */
export interface Audio90Synthesiser {
    /** The rate it renders at, in samples a second. */
    readonly sampleRate: number;
    /** Makes a sound playable by id. It runs once per sound until the next `reset`, so it is not on a hot path. */
    defineSound: (id: number, data: Audio90SoundData) => void;
    /**
     * Copies a sample into sample memory, playable by id. Returns false, and
     * keeps none of it, if it does not fit in what is left of the memory.
     * Not on a hot path.
     */
    defineSample: (id: number, data: Audio90SampleData) => boolean;
    /**
     * Queues `count` commands to apply at their stamps. Each takes
     * `COMMAND_STRIDE` numbers. The synthesiser copies them, so the caller can
     * reuse `commands` at once.
     */
    enqueue: (commands: Float64Array, count: number) => void;
    /**
     * Renders `frames` stereo samples into `left` and `right`, from index
     * `offset`. The first sample is at chip time `fromMs`, and each sample is
     * `msPerSample` ms after the one before. Each queued command applies at
     * the first sample at or after its stamp. An `msPerSample` of 0 holds
     * chip time still: the voices sound on, and only the commands stamped at
     * or before `fromMs` apply.
     */
    render: (left: Float32Array, right: Float32Array, offset: number, frames: number, fromMs: number, msPerSample: number) => void;
    /**
     * Cuts every voice, empties the queue, and forgets every sound and
     * sample. The effects, the character and the tempo go back to
     * their defaults.
     */
    reset: () => void;
    /** Whether voice `voice` is making a sound. */
    isSounding: (voice: number) => boolean;
    /** How many analog oscillators the sounding voices run, which `AUDIO90_OSCILLATOR_BUDGET` caps. */
    readonly oscillatorCount: number;
    /** The id of the sound voice `voice` was played with, as `OP_PLAY` plays one, or undefined. */
    findSoundOn: (voice: number) => number | undefined;
    /**
     * Where to write each voice's output for a scope, or undefined for none.
     * It holds `toScopeLength(AUDIO90_VOICE_COUNT)` numbers: `SCOPE_POINTS`
     * points a voice, one every `SCOPE_STRIDE` samples, round and round, then
     * each voice's pan, from -1 (left) to 1 (right). A silent voice's points
     * and pan are 0.
     */
    scope: Float32Array | undefined;
}

/** Sample memory, in 16-bit samples: 512 KB, which is 8 seconds at 32 kHz. */
export const AUDIO90_SAMPLE_MEMORY = 262144;

/** The most oscillators the analog voices may run at once, across the chip. */
export const AUDIO90_OSCILLATOR_BUDGET = 48;

/**
 * Each effect's settings as the chip starts, and after a reset. A song that
 * sets an effect starts from these for the settings it leaves out.
 */
export const AUDIO90_EFFECT_DEFAULTS = Object.freeze({
    reverb: Object.freeze({ size: 0.6, decayMs: 1800, damping: 0.4, level: 0.4 }),
    echo: Object.freeze({ timeMs: 300, timeBeats: 0, feedback: 0.35, toneHz: 5000, pingPong: 0, level: 0.4 }),
    chorus: Object.freeze({ depth: 0.5, rateHz: 0.6, level: 0.5 }),
    pump: Object.freeze({ voice: -1, depth: 0.5, releaseMs: 200 }),
}) satisfies { readonly [E in Audio90EffectId]: Readonly<Record<Audio90EffectSetting<E>, number>> };

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to make an `Audio90Synthesiser`. */
export interface Audio90SynthesiserOptions {
    /** The rate to render at, in samples a second. */
    readonly sampleRate: number;
    /** How the chip sounds until a song sets it. Defaults to `studio`. */
    readonly character?: Audio90Character;
    /** How many commands the queue holds. Defaults to 4096. */
    readonly queueCapacity?: number;
    /**
     * Whether the chorus, the echo and the reverb run. Defaults to true. A
     * bounce whose song sets none of them turns them off, since they would be
     * silent, which saves about a fifth of its time.
     */
    readonly hasEffects?: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Creates an Audio90's synthesiser. It starts silent, with every voice idle and the mix at 1. */
export function createAudio90Synthesiser(options: Audio90SynthesiserOptions): Audio90Synthesiser {
    const { sampleRate } = options;
    const hasEffects = options.hasEffects ?? true;
    const V = AUDIO90_VOICE_COUNT;
    const msPerAudioSample = 1000 / sampleRate;
    const maxCutoffHz = sampleRate * MAX_CUTOFF_SHARE;
    const controlMs = CONTROL_SAMPLES * msPerAudioSample;
    const defaultCharacter = AUDIO90_CHARACTERS.indexOf(options.character ?? 'studio');
    const consoleSmoothing = 1 - Math.exp(-2 * Math.PI * CONSOLE_SAMPLE_HZ / sampleRate);

    const sounds = new Map<number, Audio90SoundData>();
    const samples = new Map<number, SampleSlot>();
    const sampleMemory = new Float32Array(AUDIO90_SAMPLE_MEMORY);
    let sampleMemoryUsed = 0;

    // ---- Envelopes: per voice, the volume, the mod, and one per operator ----
    const envelopes = createEnvelopes({ count: V * ENVS_PER_VOICE, sampleRate });
    const envStage = envelopes.stage;
    const envLevel = envelopes.level;

    // ---- Voices ------------------------------------------------------------------
    const voiceData: (Audio90SoundData | undefined)[] = [];
    const engine = new Int32Array(V);
    const noteVolume = new Float64Array(V);
    const soundVolume = new Float64Array(V);
    const stepVolume = new Float64Array(V);
    const velocity = new Float64Array(V);
    const isAccented = new Uint8Array(V);
    const accentAmount = new Float64Array(V);
    // The sound's pan for this note, which a step row can change, and the channel's, which lasts across notes
    const notePan = new Float64Array(V);
    const channelPan = new Float64Array(V);
    const panL = new Float64Array(V);
    const panR = new Float64Array(V);
    // Each voice's pan as its controls last set it, for a scope
    const voicePan = new Float64Array(V);
    // The sound's sends, the channel's, and their sum, which the samples read
    const soundSends = new Float64Array(V * SEND_COUNT);
    const channelSends = new Float64Array(V * SEND_COUNT);
    const sends = new Float64Array(V * SEND_COUNT);
    // Brightness: the note's (a step row's), the channel's, and what the voice plays now
    const noteBrightness = new Float64Array(V);
    const channelBrightness = new Float64Array(V);
    const brightness = new Float64Array(V);
    const modPitch = new Float64Array(V);
    const modCutoff = new Float64Array(V);
    const modBrightness = new Float64Array(V);
    const lfoShape = new Int32Array(V);
    const lfoHz = new Float64Array(V);
    const lfoBeats = new Float64Array(V);
    const lfoDelayMs = new Float64Array(V);
    const lfoPhase = new Float64Array(V);
    const lfoRandom = new Float64Array(V);
    const lfoSeed = new Int32Array(V);
    const lfoAmounts = new Float64Array(V * LFO_TARGETS);
    const lfoGain = new Float64Array(V);
    const voiceL = new Float64Array(V);
    const voiceR = new Float64Array(V);

    // Filter: one per voice, with a second for a stereo voice
    const filterMode = new Int32Array(V);
    const cutoffHz = new Float64Array(V);
    const resonance = new Float64Array(V);
    const drive = new Float64Array(V);
    const keyTrack = new Float64Array(V);
    // The ladder's tuning, and the state-variable filter's coefficients
    const filterG = new Float64Array(V);
    const ladderFeedback = new Float64Array(V);
    const filterCoefficients = new Float64Array(V * SVF_STRIDE);
    const filterState = new Float64Array(V * 8);

    // FM
    const opCount = new Int32Array(V);
    const opPhase = new Float64Array(V * MAX_OPERATORS);
    const opInc = new Float64Array(V * MAX_OPERATORS);
    const opRatio = new Float64Array(V * MAX_OPERATORS);
    const opFixedHz = new Float64Array(V * MAX_OPERATORS);
    const opLevel = new Float64Array(V * MAX_OPERATORS);
    const opWave = new Int32Array(V * MAX_OPERATORS);
    const opOut = new Float64Array(V * MAX_OPERATORS);
    const opModMask = new Int32Array(V * MAX_OPERATORS);
    const opIsCarrier = new Uint8Array(V * MAX_OPERATORS);
    const carrierScale = new Float64Array(V);
    const feedback = new Float64Array(V);
    const feedbackHistory = new Float64Array(V * 2);

    // Analog
    const analogWave = new Int32Array(V);
    const unisonWanted = new Int32Array(V);
    const unison = new Int32Array(V);
    const detune = new Float64Array(V);
    const spread = new Float64Array(V);
    const chord = new Float64Array(V * MAX_UNISON);
    const chordLength = new Int32Array(V);
    const uPhase = new Float64Array(V * MAX_UNISON);
    const uInc = new Float64Array(V * MAX_UNISON);
    const uRatio = new Float64Array(V * MAX_UNISON);
    const uGainL = new Float64Array(V * MAX_UNISON);
    const uGainR = new Float64Array(V * MAX_UNISON);
    const isStereo = new Uint8Array(V);
    const pulseWidth = new Float64Array(V);
    const intervalRatioB = new Float64Array(V);
    const levelB = new Float64Array(V);
    const isSyncedB = new Uint8Array(V);
    const phaseB = new Float64Array(V);
    const incB = new Float64Array(V);
    const subLevel = new Float64Array(V);
    const subPhase = new Float64Array(V);
    const noiseLevel = new Float64Array(V);
    const noiseState = new Int32Array(V);

    // Sample
    const sampleStart = new Int32Array(V);
    const sampleLength = new Int32Array(V);
    const sampleRateRatio = new Float64Array(V);
    const sampleRoot = new Float64Array(V);
    const samplePos = new Float64Array(V);
    const sampleInc = new Float64Array(V);
    const sampleDirection = new Float64Array(V);
    const regionStart = new Float64Array(V);
    const regionEnd = new Float64Array(V);
    const loopStart = new Float64Array(V);
    const loopEnd = new Float64Array(V);
    const isLooping = new Uint8Array(V);
    const isPingPong = new Uint8Array(V);
    const isReversed = new Uint8Array(V);
    const sliceCount = new Int32Array(V);
    const sampleSmooth = new Float64Array(V);

    // Which sound each voice was played with, and which play it is
    const plays = createSoundPlays({ voiceCount: V, isSounding: isVoiceSounding, release });
    const soundId = plays.soundId;
    // How the next play plays, as its `OP_PLAY_OPTIONS` said: its length in ms, or -1 to hold, its glide's note, or
    // -1, and its pan, if it has one of its own
    let nextPlayLengthMs = -1;
    let nextPlayGlideTo = -1;
    let nextPlayPan = 0;
    let hasNextPlayPan = false;

    // The driver moves each voice's note on: its steps' pitch, arpeggio, vibrato, glides, slides and length
    const driver = createNoteDriver<Audio90StepData>({ voiceCount: V, sampleRate, onStep: applyStep, onEnd: release });
    const currentNote = driver.currentNote;
    const noteSamples = driver.noteSamples;

    // ---- Effects ----------------------------------------------------------------
    const chorusSize = Math.ceil(sampleRate * CHORUS_LINE_S);
    const chorusLine = new Float32Array(chorusSize);
    const echoSize = Math.ceil(sampleRate * MAX_ECHO_MS / 1000) + 1;
    const echoLineL = new Float32Array(echoSize);
    const echoLineR = new Float32Array(echoSize);
    const reverbLengths = new Int32Array(REVERB_LINES);
    const reverbOffsets = new Int32Array(REVERB_LINES);
    const reverbWrite = new Int32Array(REVERB_LINES);
    const reverbGain = new Float64Array(REVERB_LINES);
    const reverbLines = new Float32Array(computeReverbTotal(sampleRate));
    const diffuserLines = new Float32Array(DIFFUSER_LENGTHS_48K.length * DIFFUSER_MAX);
    const diffuserLengths = new Int32Array(DIFFUSER_LENGTHS_48K.length);
    const diffuserWrite = new Int32Array(DIFFUSER_LENGTHS_48K.length);
    // Every double that changes as sound plays is kept in a typed array. V8
    // boxes one kept in a closure variable each time it is written
    const fx = new Float64Array(FX_COUNT);
    // The write positions, the sample count and the scope counter, as whole numbers
    const counters = new Float64Array(COUNTER_COUNT);
    let controlCountdown = 0;

    // The effects' settings, which change only with commands
    let reverbSize = 0;
    let reverbDecayMs = 0;
    let reverbDamping = 0;
    let reverbLevel = 0;
    let echoMs = 0;
    let echoBeats = 0;
    let echoFeedback = 0;
    let echoTone = 0;
    let isEchoPingPong = false;
    let echoLevel = 0;
    let echoDelay = 1;
    let chorusDepth = 0;
    let chorusHz = 0;
    let chorusLevel = 0;
    let pumpVoice = -1;
    let pumpDepth = 0;
    let pumpCoef = 0;
    let character = defaultCharacter;
    let bpm = DEFAULT_BPM;
    // The tempo the LFOs follow. It is 0 while a song is held, which holds them. The echo keeps `bpm`, the last tempo above 0
    let lfoBpm = DEFAULT_BPM;

    const scheduler = createCommandScheduler({ capacity: options.queueCapacity, apply, renderRun: renderSamples });
    // The two sides being rendered into
    let left: Float32Array = new Float32Array(0);
    let right = left;

    resetAll();

    const synthesiser: Audio90Synthesiser = {
        sampleRate,
        scope: undefined,

        defineSound(id, data) {
            sounds.set(id, data);
        },

        defineSample(id, data) {
            const length = data.data.length;
            if (length === 0 || sampleMemoryUsed + length > AUDIO90_SAMPLE_MEMORY) return false;
            const start = sampleMemoryUsed;
            for (let i = 0; i < length; i++) sampleMemory[start + i] = data.data[i] / 32768;
            sampleMemoryUsed += length;
            samples.set(id, { start, length, data });
            return true;
        },

        enqueue: scheduler.enqueue,

        render(intoLeft, intoRight, offset, frames, fromMs, msPerSample) {
            left = intoLeft;
            right = intoRight;
            scheduler.render(offset, frames, fromMs, msPerSample);
        },

        reset() {
            sounds.clear();
            samples.clear();
            sampleMemoryUsed = 0;
            resetAll();
        },

        isSounding: isVoiceSounding,

        get oscillatorCount() {
            let count = 0;
            for (let v = 0; v < V; v++) {
                if (engine[v] === ENGINE_ANALOG && envStage[v * ENVS_PER_VOICE] !== ENV_IDLE) count += unison[v];
            }
            return count;
        },

        findSoundOn: plays.findSoundOn,
    };

    return synthesiser;

    // ---- Commands ----------------------------------------------------------------

    function apply(commands: Float64Array, at: number): void {
        const op = commands[at];
        const a = commands[at + 2];
        const b = commands[at + 3];
        const c = commands[at + 4];
        const d = commands[at + 5];
        switch (op) {
            case OP_NOTE_ON: {
                const data = sounds.get(b);
                if (data !== undefined && isVoice(a)) startNote(a, data, c, d);
                break;
            }
            case OP_NOTE_OFF:
                if (isVoice(a)) release(a);
                break;
            case OP_SET_VOICE:
                if (isVoice(a)) setVoice(a, b, c);
                break;
            case OP90_SET_EFFECT:
                setEffect(a, b, c);
                break;
            case OP_PLAY_OPTIONS:
                nextPlayLengthMs = a;
                nextPlayGlideTo = b;
                nextPlayPan = c;
                hasNextPlayPan = d === 1;
                break;
            case OP_PLAY:
                playSound(a, b, c, d);
                break;
            case OP_STOP:
                plays.stop(a);
                break;
            case OP_RELEASE_ALL:
                for (let v = 0; v < V; v++) release(v);
                break;
            case OP90_SET_CHARACTER:
                if (a >= 0 && a < AUDIO90_CHARACTERS.length) character = Math.floor(a);
                break;
            case OP90_SET_TEMPO:
                if (a >= 0) lfoBpm = a;
                if (a > 0) {
                    bpm = a;
                    updateEchoDelay();
                }
                break;
        }
    }

    /**
     * Starts a note on voice `v`. A legato sound's note that overlaps the
     * one before, on the same sound, ties into it: it glides, and its
     * envelopes run on rather than starting again.
     */
    function startNote(v: number, data: Audio90SoundData, note: number, volume: number): void {
        const amp = v * ENVS_PER_VOICE;
        const stage = envStage[amp];
        const isHeld = stage !== ENV_IDLE && stage !== ENV_RELEASE;
        const isTied = data.isLegato && isHeld && voiceData[v] === data;
        const isNew = engine[v] !== data.engine || stage === ENV_IDLE;
        const shouldGlide = data.glideMs > 0 && (data.isLegato ? isTied : stage !== ENV_IDLE);
        voiceData[v] = data;
        engine[v] = data.engine;

        driver.start(v, data, note);
        if (shouldGlide) driver.setGlide(v, data.glideMs);

        noteVolume[v] = Math.max(0, volume);
        velocity[v] = clamp(volume, 0, 1);
        soundVolume[v] = data.volume;
        stepVolume[v] = 1;
        isAccented[v] = 0;
        accentAmount[v] = data.accent;
        notePan[v] = data.pan;
        noteBrightness[v] = 1;
        soundSends[v * SEND_COUNT + SEND_REVERB] = data.reverb;
        soundSends[v * SEND_COUNT + SEND_ECHO] = data.echo;
        soundSends[v * SEND_COUNT + SEND_CHORUS] = data.chorus;
        modPitch[v] = data.modPitch;
        modCutoff[v] = data.modCutoff;
        modBrightness[v] = data.modBrightness;
        lfoShape[v] = data.lfoShape;
        lfoHz[v] = data.lfoHz;
        lfoBeats[v] = data.lfoBeats;
        lfoDelayMs[v] = data.lfoDelayMs;
        if (data.isLfoRetriggered && !isTied) lfoPhase[v] = 0;
        lfoAmounts[v * LFO_TARGETS + LFO_PITCH] = data.lfoPitch;
        lfoAmounts[v * LFO_TARGETS + LFO_CUTOFF] = data.lfoCutoff;
        lfoAmounts[v * LFO_TARGETS + LFO_BRIGHTNESS] = data.lfoBrightness;
        lfoAmounts[v * LFO_TARGETS + LFO_VOLUME] = data.lfoVolume;
        lfoAmounts[v * LFO_TARGETS + LFO_PAN] = data.lfoPan;
        filterMode[v] = data.filterMode;
        cutoffHz[v] = data.cutoffHz;
        resonance[v] = clamp(data.resonance, 0, 1);
        drive[v] = clamp(data.drive, 0, 1);
        keyTrack[v] = data.keyTrack;
        // Only an analog voice with spread copies is stereo. `layOutUnison` sets it for one
        isStereo[v] = 0;

        if (!isTied) {
            envelopes.start(amp, data.envelope, 1);
            envelopes.start(amp + ENV_MOD, data.modEnvelope, 1);
            if (isNew) for (let i = 0; i < 8; i++) filterState[v * 8 + i] = 0;
        }
        if (data.engine === ENGINE_FM) startFm(v, data, note, isTied);
        else if (data.engine === ENGINE_ANALOG) startAnalog(v, data, isNew);
        else startSample(v, data);

        plays.startNote(v, counters[COUNTER_SAMPLES]);
        // The pump ducks the music on each note of its voice
        if (v === pumpVoice) fx[FX_PUMP] = 1 - pumpDepth;
        controlVoice(v, 0);
    }

    function startFm(v: number, data: Audio90SoundData, note: number, isTied: boolean): void {
        const operators = data.operators;
        const count = Math.min(MAX_OPERATORS, operators.length);
        opCount[v] = count;
        feedback[v] = clamp(data.feedback, 0, 1);
        const rateScale = Math.exp(-(note - 60) * data.rateScaling * LN_SEMITONE);
        let carriers = 0;
        for (let o = 0; o < MAX_OPERATORS; o++) {
            const i = v * MAX_OPERATORS + o;
            // Only the operators this note has can modulate
            opModMask[i] = o < data.algorithm.length ? data.algorithm[o] & ((1 << count) - 1) : 0;
            opIsCarrier[i] = 0;
            const op = operators[o];
            if (op === undefined) {
                opOut[i] = 0;
                continue;
            }
            opRatio[i] = op.ratio * Math.exp(op.detuneCents / 100 * LN_SEMITONE);
            opFixedHz[i] = op.fixedHz;
            opLevel[i] = op.level * (1 - op.velocity * (1 - velocity[v]));
            opWave[i] = op.wave;
            if (!isTied) {
                opPhase[i] = 0;
                opOut[i] = 0;
                envelopes.start(v * ENVS_PER_VOICE + ENV_OP + o, op.envelope, rateScale);
            }
        }
        if (!isTied) {
            feedbackHistory[v * 2] = 0;
            feedbackHistory[v * 2 + 1] = 0;
        }
        // An operator that modulates no other is heard
        for (let o = 0; o < count; o++) {
            let modulatesAny = false;
            for (let t = 0; t < o; t++) if ((opModMask[v * MAX_OPERATORS + t] & (1 << o)) !== 0) modulatesAny = true;
            if (!modulatesAny) {
                opIsCarrier[v * MAX_OPERATORS + o] = 1;
                carriers++;
            }
        }
        carrierScale[v] = carriers > 0 ? 1 / Math.sqrt(carriers) : 0;
    }

    function startAnalog(v: number, data: Audio90SoundData, isNew: boolean): void {
        analogWave[v] = data.wave;
        unisonWanted[v] = clamp(Math.round(data.unison), 0, MAX_UNISON);
        detune[v] = clamp(data.detune, 0, 1);
        spread[v] = clamp(data.spread, 0, 1);
        const length = Math.min(MAX_UNISON, data.chord.length);
        chordLength[v] = length;
        for (let i = 0; i < length; i++) chord[v * MAX_UNISON + i] = data.chord[i];
        pulseWidth[v] = clamp(data.pulseWidth, 0.01, 0.99);
        intervalRatioB[v] = Math.exp(data.intervalB * LN_SEMITONE);
        levelB[v] = data.levelB;
        isSyncedB[v] = data.isSyncedB ? 1 : 0;
        subLevel[v] = data.sub;
        noiseLevel[v] = data.noise;
        if (noiseState[v] === 0) noiseState[v] = NOISE_SEED + v * 7919;
        // Seven free-running copies would start in step, and phase against each other, so each starts at its own place
        if (isNew) {
            for (let u = 0; u < MAX_UNISON; u++) uPhase[v * MAX_UNISON + u] = (u * GOLDEN) % 1;
            phaseB[v] = 0;
            subPhase[v] = 0;
        }
        layOutUnison(v);
    }

    /**
     * Works out how many copies voice `v`'s oscillator plays, within the
     * oscillator budget, and how each is tuned and panned.
     */
    function layOutUnison(v: number): void {
        let used = 0;
        for (let w = 0; w < V; w++) {
            if (w !== v && engine[w] === ENGINE_ANALOG && envStage[w * ENVS_PER_VOICE] !== ENV_IDLE) used += unison[w];
        }
        const chords = chordLength[v];
        const wanted = Math.max(unisonWanted[v], chords);
        // A note over the budget plays with fewer copies, so it never goes silent. One with no oscillator stays at none
        const n = wanted === 0 ? 0 : Math.max(1, Math.min(wanted, AUDIO90_OSCILLATOR_BUDGET - used));
        unison[v] = n;
        isStereo[v] = n > 1 && spread[v] > 0 ? 1 : 0;
        const copyGain = 1 / Math.sqrt(Math.max(1, n));
        for (let u = 0; u < n; u++) {
            const k = v * MAX_UNISON + u;
            const position = n === 1 ? 0 : (u / (n - 1)) * 2 - 1;
            const offset = (chords > 0 ? chord[v * MAX_UNISON + (u % chords)] : 0) + position * detune[v] * MAX_DETUNE_SEMITONES;
            uRatio[k] = Math.exp(offset * LN_SEMITONE);
            const pan = position * spread[v];
            uGainL[k] = copyGain * Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
            uGainR[k] = copyGain * Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
        }
    }

    function startSample(v: number, data: Audio90SoundData): void {
        const slot = samples.get(data.sample);
        if (slot === undefined) {
            envStage[v * ENVS_PER_VOICE] = ENV_IDLE;
            return;
        }
        const sample = slot.data;
        sampleStart[v] = slot.start;
        sampleLength[v] = slot.length;
        sampleRateRatio[v] = sample.sampleRate / sampleRate;
        sampleRoot[v] = Number.isNaN(data.rootNote) ? sample.rootNote : data.rootNote;
        isReversed[v] = data.isReversed ? 1 : 0;
        sliceCount[v] = Math.max(1, Math.floor(sample.slices));
        const hasLoop = sample.loopStart >= 0 && sample.loopEnd > sample.loopStart && sliceCount[v] === 1 && !data.isReversed;
        isLooping[v] = hasLoop ? 1 : 0;
        isPingPong[v] = hasLoop && sample.isPingPong ? 1 : 0;
        loopStart[v] = hasLoop ? sample.loopStart : 0;
        loopEnd[v] = hasLoop ? Math.min(sample.loopEnd, slot.length) : slot.length;
        sampleSmooth[v] = 0;
        playSlice(v, 0);
    }

    /** Starts voice `v`'s sample from the beginning of slice `slice`, or its end if it plays backwards. */
    function playSlice(v: number, slice: number): void {
        const n = sliceCount[v];
        const s = clamp(Math.floor(slice), 0, n - 1);
        const length = sampleLength[v];
        regionStart[v] = Math.floor(s * length / n);
        regionEnd[v] = Math.floor((s + 1) * length / n);
        sampleDirection[v] = isReversed[v] === 1 ? -1 : 1;
        samplePos[v] = isReversed[v] === 1 ? regionEnd[v] - 1 : regionStart[v];
    }

    function release(v: number): void {
        const base = v * ENVS_PER_VOICE;
        for (let e = 0; e < ENVS_PER_VOICE; e++) envelopes.release(base + e);
    }

    function setVoice(v: number, setting: number, value: number): void {
        switch (setting) {
            case AUDIO90_VOICE_SETTING_INDEX.volume:
                noteVolume[v] = Math.max(0, value);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.pan:
                channelPan[v] = clamp(value, -1, 1);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.brightness:
                channelBrightness[v] = clamp(value, 0, 1);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.reverbSend:
                channelSends[v * SEND_COUNT + SEND_REVERB] = clamp(value, 0, 1);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.echoSend:
                channelSends[v * SEND_COUNT + SEND_ECHO] = clamp(value, 0, 1);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.chorusSend:
                channelSends[v * SEND_COUNT + SEND_CHORUS] = clamp(value, 0, 1);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.arpeggio:
                driver.setArpeggio(v, value);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.vibratoDepth:
                driver.setVibratoDepth(v, value);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.vibratoRate:
                driver.setVibratoRate(v, value);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.slide:
                driver.setSlide(v, value);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.glide:
                driver.setGlide(v, value);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.chord:
                if (value <= 0) {
                    chordLength[v] = 0;
                }
                else {
                    chord[v * MAX_UNISON] = 0;
                    chord[v * MAX_UNISON + 1] = Math.floor(value / 16);
                    chord[v * MAX_UNISON + 2] = value % 16;
                    chordLength[v] = 3;
                }
                if (engine[v] === ENGINE_ANALOG) layOutUnison(v);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.slice:
                if (engine[v] === ENGINE_SAMPLE) playSlice(v, value);
                break;
            case AUDIO90_VOICE_SETTING_INDEX.accent:
                isAccented[v] = value > 0 ? 1 : 0;
                break;
            case AUDIO90_VOICE_SETTING_INDEX.pulseWidth:
                pulseWidth[v] = clamp(value, 0.01, 0.99);
                break;
        }
    }

    function setEffect(effect: number, setting: number, value: number): void {
        switch (effect) {
            case AUDIO90_EFFECT_INDEX.reverb:
                switch (setting) {
                    case AUDIO90_EFFECT_SETTING_INDEX.reverb.size:
                        reverbSize = clamp(value, 0, 1);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.reverb.decayMs:
                        reverbDecayMs = clamp(value, MIN_REVERB_DECAY_MS, MAX_REVERB_DECAY_MS);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.reverb.damping:
                        reverbDamping = clamp(value, 0, 1);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.reverb.level:
                        reverbLevel = clamp(value, 0, 1);
                        break;
                }
                layOutReverb();
                break;
            case AUDIO90_EFFECT_INDEX.echo:
                switch (setting) {
                    case AUDIO90_EFFECT_SETTING_INDEX.echo.timeMs:
                        echoMs = Math.max(0, value);
                        echoBeats = 0;
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.echo.timeBeats:
                        echoBeats = Math.max(0, value);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.echo.feedback:
                        echoFeedback = clamp(value, 0, MAX_ECHO_FEEDBACK);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.echo.toneHz:
                        echoTone = toOnePole(value);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.echo.pingPong:
                        isEchoPingPong = value > 0;
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.echo.level:
                        echoLevel = clamp(value, 0, 1);
                        break;
                }
                updateEchoDelay();
                break;
            case AUDIO90_EFFECT_INDEX.chorus:
                switch (setting) {
                    case AUDIO90_EFFECT_SETTING_INDEX.chorus.depth:
                        chorusDepth = clamp(value, 0, 1);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.chorus.rateHz:
                        chorusHz = clamp(value, 0, MAX_CHORUS_HZ);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.chorus.level:
                        chorusLevel = clamp(value, 0, 1);
                        break;
                }
                break;
            case AUDIO90_EFFECT_INDEX.pump:
                switch (setting) {
                    case AUDIO90_EFFECT_SETTING_INDEX.pump.voice:
                        pumpVoice = isVoice(value) ? value : -1;
                        if (pumpVoice < 0) fx[FX_PUMP] = 1;
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.pump.depth:
                        pumpDepth = clamp(value, 0, 1);
                        break;
                    case AUDIO90_EFFECT_SETTING_INDEX.pump.releaseMs:
                        pumpCoef = toRecovery(Math.max(1, value));
                        break;
                }
                break;
        }
    }

    /** Plays sound `id` on a voice it chooses, as play `play`, with the options the `OP_PLAY_OPTIONS` before it gave. */
    function playSound(id: number, play: number, note: number, volume: number): void {
        const lengthMs = nextPlayLengthMs;
        const glideTo = nextPlayGlideTo;
        const pan = nextPlayPan;
        const hasPan = hasNextPlayPan;
        nextPlayLengthMs = -1;
        nextPlayGlideTo = -1;
        nextPlayPan = 0;
        hasNextPlayPan = false;
        const data = sounds.get(id);
        if (data === undefined) return;
        const v = plays.choose(id, data.priority, data.maxVoices);
        if (v < 0) return;
        // The voice takes none of the channel settings a song left on it. A pan of the play's own moves the
        // sound from its own pan to there
        channelPan[v] = hasPan ? clamp(pan, -1, 1) - data.pan : 0;
        channelBrightness[v] = 1;
        for (let i = 0; i < SEND_COUNT; i++) channelSends[v * SEND_COUNT + i] = 0;
        startNote(v, data, note, volume);
        plays.claim(v, id, data.priority, play);
        // A held note has no set length, so it plays until it is stopped
        if (lengthMs < 0) return;
        // At least one sample. A length of 0 means the note has no set length, so it would never be released
        driver.setLength(v, Math.max(1, lengthMs / msPerAudioSample));
        if (glideTo >= 0) {
            driver.glideBetween(v, note, glideTo, lengthMs);
            controlVoice(v, 0);
        }
    }

    /** Applies what a step row sets besides its pitch, which the driver takes. */
    function applyStep(v: number, step: Audio90StepData): void {
        if (step.volume >= 0) stepVolume[v] = step.volume;
        if (!Number.isNaN(step.pan)) notePan[v] = clamp(step.pan, -1, 1);
        if (step.brightness >= 0) noteBrightness[v] = clamp(step.brightness, 0, 1);
        if (step.slice >= 0 && engine[v] === ENGINE_SAMPLE) playSlice(v, step.slice);
        if (step.wave >= 0) analogWave[v] = step.wave;
    }

    // ---- Controls: every `CONTROL_SAMPLES` samples ----------------------------

    function controlAll(): void {
        let chorusPhase = fx[FX_CHORUS_PHASE] + chorusHz * controlMs / 1000;
        if (chorusPhase >= 1) chorusPhase -= Math.floor(chorusPhase);
        fx[FX_CHORUS_PHASE] = chorusPhase;
        for (let v = 0; v < V; v++) {
            if (envStage[v * ENVS_PER_VOICE] !== ENV_IDLE) controlVoice(v, CONTROL_SAMPLES);
        }
        // Every state but the pump's level and the chorus's phase, which are not states that fade
        clearTinyValues(filterState);
        clearTinyValues(fx, 0, FX_PUMP);
        clearTinyValues(fx, FX_REVERB_DAMP);
        clearTinyValues(sampleSmooth);
    }

    /** Sets voice `v`'s pitches, LFO, brightness, filter, pan and sends for the next `CONTROL_SAMPLES` samples. */
    function controlVoice(v: number, elapsed: number): void {
        driver.control(v, elapsed);
        const noteMs = noteSamples[v] * msPerAudioSample;

        // The LFO, from -1 to 1. Its rate follows the tempo when it is set in beats
        const rate = lfoBeats[v] > 0 ? lfoBpm / 60 / lfoBeats[v] : lfoHz[v];
        let phase = lfoPhase[v] + rate * elapsed / sampleRate;
        if (phase >= 1) {
            phase -= Math.floor(phase);
            if (lfoShape[v] === LFO_RANDOM) {
                let seed = lfoSeed[v];
                seed ^= seed << 13;
                seed ^= seed >>> 17;
                seed ^= seed << 5;
                lfoSeed[v] = seed;
                lfoRandom[v] = seed / 2147483648;
            }
        }
        lfoPhase[v] = phase;
        let lfo = 0;
        if (noteMs >= lfoDelayMs[v]) {
            const shape = lfoShape[v];
            if (shape === LFO_TRIANGLE) lfo = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
            else if (shape === LFO_SQUARE) lfo = phase < 0.5 ? 1 : -1;
            else if (shape === LFO_SAW) lfo = 2 * phase - 1;
            else if (shape === LFO_RANDOM) lfo = lfoRandom[v];
            else lfo = SINE[(phase * TABLE_SIZE) | 0];
        }
        const lfoAt = v * LFO_TARGETS;
        // The volume dips as the LFO falls, so a square LFO is a gate that is open on the beat
        lfoGain[v] = 1 - lfoAmounts[lfoAt + LFO_VOLUME] * (0.5 - 0.5 * lfo);

        const mod = envLevel[v * ENVS_PER_VOICE + ENV_MOD];
        const pitch = currentNote[v] + mod * modPitch[v] + lfo * lfoAmounts[lfoAt + LFO_PITCH];
        const inc = 440 * Math.exp((pitch - 69) * LN_SEMITONE) / sampleRate;
        // `Math.min` and `Math.max` rather than `clamp`, here and below. A choice between a computed double and a
        // constant can make V8 box the double each time, and this runs for every voice every 32 samples
        const bright = Math.min(1, Math.max(0, channelBrightness[v] * noteBrightness[v] + mod * modBrightness[v] + lfo * lfoAmounts[lfoAt + LFO_BRIGHTNESS]));
        brightness[v] = bright;

        const kind = engine[v];
        if (kind === ENGINE_FM) {
            for (let o = 0; o < opCount[v]; o++) {
                const i = v * MAX_OPERATORS + o;
                const fixed = opFixedHz[i];
                opInc[i] = fixed > 0 ? fixed / sampleRate : inc * opRatio[i];
            }
        }
        else if (kind === ENGINE_ANALOG) {
            const n = unison[v];
            for (let u = 0; u < n; u++) uInc[v * MAX_UNISON + u] = inc * uRatio[v * MAX_UNISON + u];
            incB[v] = inc * intervalRatioB[v];
        }
        else {
            sampleInc[v] = sampleRateRatio[v] * Math.exp((pitch - sampleRoot[v]) * LN_SEMITONE);
        }

        const mode = filterMode[v];
        if (mode !== FILTER90_NONE) {
            const accent = 1 + accentAmount[v] * isAccented[v];
            const octaves = mod * modCutoff[v] * accent + lfo * lfoAmounts[lfoAt + LFO_CUTOFF]
                + (pitch - 60) / 12 * keyTrack[v] + (bright - 1) * BRIGHTNESS_OCTAVES;
            const cutoff = Math.min(maxCutoffHz, Math.max(MIN_CUTOFF_HZ, cutoffHz[v] * Math.exp(octaves * Math.LN2)));
            const g = Math.tan(Math.PI * cutoff / sampleRate);
            if (mode === FILTER90_LOWPASS_24) {
                filterG[v] = g / (1 + g);
                ladderFeedback[v] = resonance[v] * LADDER_MAX_FEEDBACK;
            }
            else {
                tuneStateVariableFilter(filterCoefficients, v * SVF_STRIDE, g, resonance[v]);
            }
        }

        const pan = Math.min(1, Math.max(-1, notePan[v] + channelPan[v] + lfo * lfoAmounts[lfoAt + LFO_PAN]));
        voicePan[v] = pan;
        panL[v] = Math.cos((pan + 1) * Math.PI / 4);
        panR[v] = Math.sin((pan + 1) * Math.PI / 4);
        for (let i = 0; i < SEND_COUNT; i++) {
            const at = v * SEND_COUNT + i;
            sends[at] = Math.min(1, soundSends[at] + channelSends[at]);
        }
    }

    // ---- Samples ---------------------------------------------------------------------

    function renderSamples(start: number, count: number): void {
        const end = start + count;
        const isConsole = character === CHARACTER_CONSOLE;
        const isSampler = character === CHARACTER_SAMPLER;
        const outputDrive = isSampler ? SAMPLER_DRIVE : 1;
        const scope = synthesiser.scope;
        for (let s = start; s < end; s++) {
            if (--controlCountdown <= 0) {
                controlAll();
                controlCountdown = CONTROL_SAMPLES;
            }
            fx[FX_PUMP] += (1 - fx[FX_PUMP]) * pumpCoef;
            const scopeAt = scope !== undefined && (counters[COUNTER_SCOPE] % SCOPE_STRIDE) === 0
                ? (counters[COUNTER_SCOPE] / SCOPE_STRIDE) % SCOPE_POINTS
                : -1;
            counters[COUNTER_SCOPE] = (counters[COUNTER_SCOPE] + 1) % (SCOPE_POINTS * SCOPE_STRIDE);

            let dryL = 0;
            let dryR = 0;
            let toReverb = 0;
            let toEchoL = 0;
            let toEchoR = 0;
            let toChorus = 0;
            for (let v = 0; v < V; v++) {
                const amp = v * ENVS_PER_VOICE;
                if (envStage[amp] === ENV_IDLE) {
                    if (scopeAt >= 0) scope![v * SCOPE_POINTS + scopeAt] = 0;
                    if (scopeAt === 0) scope![SCOPE_PANS + v] = 0;
                    continue;
                }
                const kind = engine[v];
                if (kind === ENGINE_FM) renderFm(v, isConsole);
                else if (kind === ENGINE_ANALOG) renderAnalog(v);
                else renderSample(v, isConsole, isSampler);
                if (filterMode[v] !== FILTER90_NONE) filterVoice(v);
                envelopes.step(amp);
                envelopes.step(amp + ENV_MOD);
                const isEffect = soundId[v] >= 0;
                const accent = isAccented[v] === 1 ? 1 + ACCENT_GAIN * accentAmount[v] : 1;
                let g = envLevel[amp] * noteVolume[v] * soundVolume[v] * stepVolume[v] * accent * lfoGain[v] * VOICE_GAIN;
                if (!isEffect && v !== pumpVoice) g *= fx[FX_PUMP];
                let l: number;
                let r: number;
                if (isStereo[v] === 1) {
                    // A stereo voice's copies are spread already. Its pan leans the whole of it, and leaves it as it is at the centre
                    l = voiceL[v] * g * panL[v] * Math.SQRT2;
                    r = voiceR[v] * g * panR[v] * Math.SQRT2;
                }
                else {
                    const x = voiceL[v] * g;
                    l = x * panL[v];
                    r = x * panR[v];
                }
                if (scopeAt >= 0) scope![v * SCOPE_POINTS + scopeAt] = (l + r) * SCOPE_GAIN;
                if (scopeAt === 0) scope![SCOPE_PANS + v] = voicePan[v];
                dryL += l;
                dryR += r;
                const at = v * SEND_COUNT;
                toReverb += (l + r) * sends[at + SEND_REVERB];
                toEchoL += l * sends[at + SEND_ECHO];
                toEchoR += r * sends[at + SEND_ECHO];
                toChorus += (l + r) * sends[at + SEND_CHORUS];
            }
            fx[FX_DRY_L] = dryL;
            fx[FX_DRY_R] = dryR;
            fx[FX_REVERB_IN] = toReverb * 0.5;
            fx[FX_ECHO_IN_L] = toEchoL;
            fx[FX_ECHO_IN_R] = toEchoR;
            fx[FX_CHORUS_IN] = toChorus * 0.5;
            if (hasEffects) {
                runChorus();
                runEcho();
                runReverb();
            }
            const outL = fx[FX_DRY_L] + fx[FX_CHORUS_L] * chorusLevel + fx[FX_ECHO_L] * echoLevel + fx[FX_REVERB_L] * reverbLevel;
            const outR = fx[FX_DRY_R] + fx[FX_CHORUS_R] * chorusLevel + fx[FX_ECHO_R] * echoLevel + fx[FX_REVERB_R] * reverbLevel;
            // Remove any steady offset from zero, then round off loud moments rather than clipping them
            fx[FX_DC_OUT_L] = outL - fx[FX_DC_IN_L] + DC_POLE * fx[FX_DC_OUT_L];
            fx[FX_DC_IN_L] = outL;
            fx[FX_DC_OUT_R] = outR - fx[FX_DC_IN_R] + DC_POLE * fx[FX_DC_OUT_R];
            fx[FX_DC_IN_R] = outR;
            fx[FX_LIMIT_L] = fx[FX_DC_OUT_L] * outputDrive;
            fx[FX_LIMIT_R] = fx[FX_DC_OUT_R] * outputDrive;
            limit();
            left[s] = fx[FX_LIMIT_L];
            right[s] = fx[FX_LIMIT_R];
        }
        counters[COUNTER_SAMPLES] += count;
    }

    /** Writes one sample of FM voice `v` into `voiceL`. Operators only modulate lower-numbered ones, so the highest goes first. */
    function renderFm(v: number, isConsole: boolean): void {
        const count = opCount[v];
        const base = v * MAX_OPERATORS;
        const envBase = v * ENVS_PER_VOICE + ENV_OP;
        const bright = brightness[v];
        let out = 0;
        for (let o = count - 1; o >= 0; o--) {
            const i = base + o;
            envelopes.step(envBase + o);
            const mask = opModMask[i];
            let mod = 0;
            if ((mask & 2) !== 0) mod += opOut[base + 1];
            if ((mask & 4) !== 0) mod += opOut[base + 2];
            if ((mask & 8) !== 0) mod += opOut[base + 3];
            if (o === count - 1) {
                const h = v * 2;
                mod += (feedbackHistory[h] + feedbackHistory[h + 1]) * 0.5 * feedback[v] * FEEDBACK_CYCLES;
            }
            let p = opPhase[i] + opInc[i];
            if (p >= 1) p -= Math.floor(p);
            opPhase[i] = p;
            let x = p + mod * MOD_CYCLES;
            x -= Math.floor(x);
            const t = x * TABLE_SIZE;
            const j = t | 0;
            const table = opWave[i] * TABLE_STRIDE;
            const a = WAVES[table + j];
            let y = (a + (WAVES[table + j + 1] - a) * (t - j)) * envLevel[envBase + o] * opLevel[i];
            const isCarrier = opIsCarrier[i] === 1;
            // Brightness softens the modulators, so a dimmer note has fewer overtones
            if (!isCarrier) y *= bright;
            opOut[i] = y;
            if (o === count - 1) {
                const h = v * 2;
                feedbackHistory[h + 1] = feedbackHistory[h];
                feedbackHistory[h] = y;
            }
            if (isCarrier) out += y;
        }
        out *= carrierScale[v];
        // Nine bits, with a small step where the wave crosses zero, as a console's FM had. Math.sign keeps every value a double
        if (isConsole) out = Math.round(out * 255) / 255 + Math.sign(out) * CROSSOVER;
        voiceL[v] = out;
        voiceR[v] = out;
    }

    /** Writes one sample of analog voice `v` into `voiceL` and `voiceR`. */
    function renderAnalog(v: number): void {
        const n = unison[v];
        const base = v * MAX_UNISON;
        const w = analogWave[v];
        const width = pulseWidth[v];
        let l = 0;
        let r = 0;
        let hasWrapped = false;
        for (let u = 0; u < n; u++) {
            const k = base + u;
            const dt = uInc[k];
            let p = uPhase[k] + dt;
            if (p >= 1) {
                p -= Math.floor(p);
                if (u === 0) hasWrapped = true;
            }
            uPhase[k] = p;
            const x = oscillate(w, p, dt, width);
            l += x * uGainL[k];
            r += x * uGainR[k];
        }
        const b = levelB[v];
        if (b > 0) {
            const dt = incB[v];
            let p = phaseB[v] + dt;
            if (p >= 1) p -= Math.floor(p);
            // Hard sync: the second oscillator starts its cycle again whenever the first does
            if (hasWrapped && isSyncedB[v] === 1) p = uPhase[base] * (dt / Math.max(uInc[base], TINY));
            phaseB[v] = p;
            const y = oscillate(w, p, dt, width) * b;
            l += y;
            r += y;
        }
        const sub = subLevel[v];
        if (sub > 0 && n > 0) {
            let q = subPhase[v] + uInc[base] * 0.5;
            if (q >= 1) q -= Math.floor(q);
            subPhase[v] = q;
            const y = (q < 0.5 ? 1 : -1) * sub;
            l += y;
            r += y;
        }
        const noise = noiseLevel[v];
        if (noise > 0) {
            let state = noiseState[v];
            state ^= state << 13;
            state ^= state >>> 17;
            state ^= state << 5;
            noiseState[v] = state;
            const y = (state / 2147483648) * noise;
            l += y;
            r += y;
        }
        voiceL[v] = l;
        voiceR[v] = r;
    }

    /** Writes one sample of sample voice `v` into `voiceL`. A one-shot that reaches its end frees its voice. */
    function renderSample(v: number, isConsole: boolean, isSampler: boolean): void {
        let pos = samplePos[v];
        let direction = sampleDirection[v];
        if (isLooping[v] === 1) {
            if (direction > 0 && pos >= loopEnd[v]) {
                if (isPingPong[v] === 1) {
                    pos = loopEnd[v] - (pos - loopEnd[v]) - 1;
                    direction = -1;
                }
                else {
                    pos -= loopEnd[v] - loopStart[v];
                }
            }
            else if (direction < 0 && pos < loopStart[v]) {
                pos = loopStart[v] + (loopStart[v] - pos);
                direction = 1;
            }
        }
        else if (direction > 0 ? pos >= regionEnd[v] : pos < regionStart[v]) {
            envStage[v * ENVS_PER_VOICE] = ENV_IDLE;
            voiceL[v] = 0;
            return;
        }
        const i = pos | 0;
        const at = sampleStart[v] + i;
        let y: number;
        if (isSampler) {
            // The sampler's character keeps every step of the sample, unsmoothed
            y = sampleMemory[at];
        }
        else {
            const a = sampleMemory[at];
            const b = i + 1 < sampleLength[v] ? sampleMemory[at + 1] : a;
            y = a + (b - a) * (pos - i);
        }
        if (isConsole) {
            // The console's character dulls a sample, as a console's soft interpolation did
            sampleSmooth[v] += (y - sampleSmooth[v]) * consoleSmoothing;
            y = sampleSmooth[v];
        }
        voiceL[v] = y;
        samplePos[v] = pos + sampleInc[v] * direction;
        sampleDirection[v] = direction;
    }

    /** Runs voice `v`'s filter for one sample, on `voiceL` and, for a stereo voice, on `voiceR` too. */
    function filterVoice(v: number): void {
        const mode = filterMode[v];
        const sides = isStereo[v] === 1 ? 2 : 1;
        for (let side = 0; side < sides; side++) {
            const input = side === 0 ? voiceL[v] : voiceR[v];
            const st = v * 8 + side * 4;
            let y: number;
            if (mode === FILTER90_LOWPASS_24) {
                // Four one-pole stages, the last fed back for resonance, and the
                // input driven into gentle distortion: a ladder filter
                const g = filterG[v];
                const k = ladderFeedback[v];
                const gainIn = 1 + drive[v] * 3;
                let u = softClip((input - k * filterState[st + 3]) * gainIn) * (1 + k * 0.25);
                for (let stage = 0; stage < 4; stage++) {
                    const s0 = filterState[st + stage];
                    const d = (u - s0) * g;
                    const out = d + s0;
                    filterState[st + stage] = out + d;
                    u = out;
                }
                y = u / gainIn * (1 + drive[v]);
            }
            else {
                // A state-variable filter, as `tuneStateVariableFilter` describes
                const c = v * SVF_STRIDE;
                const ic1 = filterState[st];
                const ic2 = filterState[st + 1];
                const v3 = input - ic2;
                const v1 = filterCoefficients[c + SVF_A1] * ic1 + filterCoefficients[c + SVF_A2] * v3;
                const v2 = ic2 + filterCoefficients[c + SVF_A2] * ic1 + filterCoefficients[c + SVF_A3] * v3;
                filterState[st] = 2 * v1 - ic1;
                filterState[st + 1] = 2 * v2 - ic2;
                y = mode === FILTER90_LOWPASS_12 ? v2 : mode === FILTER90_BANDPASS ? v1 : input - filterCoefficients[c + SVF_K] * v1 - v2;
            }
            if (side === 0) voiceL[v] = y;
            else voiceR[v] = y;
        }
    }

    /** Soft-clips the output's two sides in place. It writes into `fx` rather than returning doubles, which V8 might box. */
    function limit(): void {
        fx[FX_LIMIT_L] = softClip(fx[FX_LIMIT_L]);
        fx[FX_LIMIT_R] = softClip(fx[FX_LIMIT_R]);
    }

    // ---- Effects -------------------------------------------------------------------

    function runChorus(): void {
        const write = counters[COUNTER_CHORUS];
        chorusLine[write] = fx[FX_CHORUS_IN];
        // Two taps whose delays move in opposite directions
        for (let side = 0; side < 2; side++) {
            const phase = (fx[FX_CHORUS_PHASE] + side * 0.25) % 1;
            const swing = SINE[(phase * TABLE_SIZE) | 0];
            const delay = (CHORUS_BASE_MS + swing * CHORUS_SWING_MS * chorusDepth) * sampleRate / 1000;
            let read = write - delay;
            if (read < 0) read += chorusSize;
            const i = read | 0;
            const a = chorusLine[i];
            const b = chorusLine[i + 1 === chorusSize ? 0 : i + 1];
            fx[FX_CHORUS_L + side] = a + (b - a) * (read - i);
        }
        counters[COUNTER_CHORUS] = write + 1 === chorusSize ? 0 : write + 1;
    }

    function runEcho(): void {
        const write = counters[COUNTER_ECHO];
        let read = write - echoDelay;
        if (read < 0) read += echoSize;
        const l = echoLineL[read];
        const r = echoLineR[read];
        // Each repeat is darker than the last. Ping-pong repeats cross to the other side
        fx[FX_ECHO_TONE_L] += echoTone * (l - fx[FX_ECHO_TONE_L]);
        fx[FX_ECHO_TONE_R] += echoTone * (r - fx[FX_ECHO_TONE_R]);
        const backL = isEchoPingPong ? fx[FX_ECHO_TONE_R] : fx[FX_ECHO_TONE_L];
        const backR = isEchoPingPong ? fx[FX_ECHO_TONE_L] : fx[FX_ECHO_TONE_R];
        // Fed in on one side only, a ping-pong echo starts on the left, then the right
        echoLineL[write] = (isEchoPingPong ? fx[FX_ECHO_IN_L] + fx[FX_ECHO_IN_R] : fx[FX_ECHO_IN_L]) + backL * echoFeedback;
        echoLineR[write] = (isEchoPingPong ? 0 : fx[FX_ECHO_IN_R]) + backR * echoFeedback;
        counters[COUNTER_ECHO] = write + 1 === echoSize ? 0 : write + 1;
        fx[FX_ECHO_L] = l;
        fx[FX_ECHO_R] = r;
    }

    /**
     * A reverb: two all-pass diffusers into eight delay lines, mixed into each
     * other through a Hadamard matrix (a feedback delay network), each line
     * darkened and fading at the rate that gives the decay time.
     */
    function runReverb(): void {
        let x = fx[FX_REVERB_IN];
        for (let d = 0; d < DIFFUSER_LENGTHS_48K.length; d++) {
            const at = d * DIFFUSER_MAX;
            const w = diffuserWrite[d];
            const delayed = diffuserLines[at + w];
            const input = x + delayed * DIFFUSION;
            diffuserLines[at + w] = input;
            x = delayed - input * DIFFUSION;
            diffuserWrite[d] = w + 1 === diffuserLengths[d] ? 0 : w + 1;
        }
        const damping = 1 - reverbDamping * 0.8;
        for (let i = 0; i < REVERB_LINES; i++) {
            const y = reverbLines[reverbOffsets[i] + reverbWrite[i]];
            fx[FX_REVERB_DAMP + i] += (y - fx[FX_REVERB_DAMP + i]) * damping;
            fx[FX_LINE + i] = fx[FX_REVERB_DAMP + i] * reverbGain[i];
        }
        fx[FX_REVERB_L] = fx[FX_LINE] - fx[FX_LINE + 2] + fx[FX_LINE + 4] - fx[FX_LINE + 6];
        fx[FX_REVERB_R] = fx[FX_LINE + 1] - fx[FX_LINE + 3] + fx[FX_LINE + 5] - fx[FX_LINE + 7];
        // An 8-point Hadamard transform, in three rounds of sums and differences
        for (let span = 1; span < REVERB_LINES; span *= 2) {
            for (let i = 0; i < REVERB_LINES; i += span * 2) {
                for (let j = i; j < i + span; j++) {
                    const a = fx[FX_LINE + j];
                    const b = fx[FX_LINE + j + span];
                    fx[FX_LINE + j] = a + b;
                    fx[FX_LINE + j + span] = a - b;
                }
            }
        }
        for (let i = 0; i < REVERB_LINES; i++) {
            const w = reverbWrite[i];
            reverbLines[reverbOffsets[i] + w] = fx[FX_LINE + i] * HADAMARD_SCALE + x;
            reverbWrite[i] = w + 1 === reverbLengths[i] ? 0 : w + 1;
        }
    }

    function layOutReverb(): void {
        const scale = sampleRate / 48000;
        let offset = 0;
        for (let i = 0; i < REVERB_LINES; i++) {
            const length = Math.max(1, Math.round(REVERB_LENGTHS_48K[i] * scale * (0.4 + 0.6 * reverbSize)));
            reverbLengths[i] = length;
            reverbOffsets[i] = offset;
            offset += Math.round(REVERB_LENGTHS_48K[i] * scale);
            if (reverbWrite[i] >= length) reverbWrite[i] = 0;
            // The gain that makes a line fall 60 dB over the decay time
            reverbGain[i] = Math.exp(-3 * Math.LN10 * length / (sampleRate * reverbDecayMs / 1000));
        }
        for (let d = 0; d < DIFFUSER_LENGTHS_48K.length; d++) {
            diffuserLengths[d] = Math.min(DIFFUSER_MAX, Math.max(1, Math.round(DIFFUSER_LENGTHS_48K[d] * scale)));
            if (diffuserWrite[d] >= diffuserLengths[d]) diffuserWrite[d] = 0;
        }
    }

    function updateEchoDelay(): void {
        const ms = echoBeats > 0 ? echoBeats * 60000 / bpm : echoMs;
        echoDelay = clamp(Math.round(ms * sampleRate / 1000), 1, echoSize - 1);
    }

    // ---- Envelopes -------------------------------------------------------------------

    /** Whether voice `v` is making a sound: whether its volume envelope is. */
    function isVoiceSounding(v: number): boolean {
        return envelopes.isSounding(v * ENVS_PER_VOICE);
    }

    /** The share of what is left that a level recovers each sample, so that it gets back within 60 dB of where it was going over `ms`. */
    function toRecovery(ms: number): number {
        return 1 - computeFall(ms, msPerAudioSample);
    }

    /** The per-sample coefficient of a one-pole low-pass filter with its cutoff at `hz`. */
    function toOnePole(hz: number): number {
        return 1 - Math.exp(-2 * Math.PI * clamp(hz, MIN_CUTOFF_HZ, sampleRate * MAX_CUTOFF_SHARE) / sampleRate);
    }

    function resetAll(): void {
        envelopes.reset();
        plays.reset();
        for (let v = 0; v < V; v++) {
            voiceData[v] = undefined;
            engine[v] = ENGINE_ANALOG;
            driver.reset(v);
            noteVolume[v] = 1;
            soundVolume[v] = 1;
            stepVolume[v] = 1;
            channelPan[v] = 0;
            notePan[v] = 0;
            channelBrightness[v] = 1;
            noteBrightness[v] = 1;
            brightness[v] = 1;
            isAccented[v] = 0;
            unison[v] = 0;
            lfoGain[v] = 1;
            lfoSeed[v] = LFO_SEED + v * 104729;
            noiseState[v] = NOISE_SEED + v * 7919;
            panL[v] = Math.SQRT1_2;
            panR[v] = Math.SQRT1_2;
        }
        channelSends.fill(0);
        soundSends.fill(0);
        sends.fill(0);
        filterState.fill(0);
        chorusLine.fill(0);
        echoLineL.fill(0);
        echoLineR.fill(0);
        reverbLines.fill(0);
        diffuserLines.fill(0);
        fx.fill(0);
        fx[FX_PUMP] = 1;
        counters.fill(0);
        nextPlayLengthMs = -1;
        nextPlayGlideTo = -1;
        nextPlayPan = 0;
        hasNextPlayPan = false;
        scheduler.clear();
        const defaults = AUDIO90_EFFECT_DEFAULTS;
        reverbSize = defaults.reverb.size;
        reverbDecayMs = defaults.reverb.decayMs;
        reverbDamping = defaults.reverb.damping;
        reverbLevel = defaults.reverb.level;
        echoMs = defaults.echo.timeMs;
        echoBeats = 0;
        echoFeedback = defaults.echo.feedback;
        echoTone = toOnePole(defaults.echo.toneHz);
        isEchoPingPong = false;
        echoLevel = defaults.echo.level;
        chorusDepth = defaults.chorus.depth;
        chorusHz = defaults.chorus.rateHz;
        chorusLevel = defaults.chorus.level;
        pumpVoice = -1;
        pumpDepth = defaults.pump.depth;
        pumpCoef = toRecovery(defaults.pump.releaseMs);
        character = defaultCharacter;
        bpm = DEFAULT_BPM;
        lfoBpm = DEFAULT_BPM;
        layOutReverb();
        updateEchoDelay();
        controlCountdown = 0;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface SampleSlot {
    /** Where it starts in sample memory. */
    readonly start: number;
    readonly length: number;
    readonly data: Audio90SampleData;
}

function isVoice(v: number): boolean {
    return Number.isInteger(v) && v >= 0 && v < AUDIO90_VOICE_COUNT;
}

/** One sample of a band-limited oscillator at phase `p`, moving `dt` a sample. */
function oscillate(wave: number, p: number, dt: number, width: number): number {
    if (wave === WAVE90_SAW) return 2 * p - 1 - polyBlep(p, dt);
    if (wave === WAVE90_PULSE) {
        let q = p - width;
        if (q < 0) q += 1;
        return (p < width ? 1 : -1) + polyBlep(p, dt) - polyBlep(q, dt);
    }
    if (wave === WAVE90_TRIANGLE) return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    return SINE[(p * TABLE_SIZE) | 0];
}

/** A cheap curve that follows tanh closely up to about 3, then holds at 1. */
function softClip(x: number): number {
    if (x <= -3) return -1;
    if (x >= 3) return 1;
    const x2 = x * x;
    return x * (27 + x2) / (27 + 9 * x2);
}

function computeReverbTotal(sampleRate: number): number {
    let total = 0;
    for (const length of REVERB_LENGTHS_48K) total += Math.round(length * sampleRate / 48000);
    return total + 1;
}

const VOICE_GAIN = 0.25;
const MAX_DETUNE_SEMITONES = 0.5;
const GOLDEN = 0.6180339887;
/** How far, in cycles, a modulator at level 1 pushes its carrier. */
const MOD_CYCLES = 1;
const FEEDBACK_CYCLES = 0.5;
const CROSSOVER = 1 / 512;
/** How far a brightness of 0 closes a filter, in octaves. */
const BRIGHTNESS_OCTAVES = 6;
/** How much louder an accented note plays, at full accent. */
const ACCENT_GAIN = 0.3;
/** The ladder's feedback at full resonance, where it rings at its cutoff. */
const LADDER_MAX_FEEDBACK = 4;
/** The console character's smoothing of samples, as a cutoff in Hz. */
const CONSOLE_SAMPLE_HZ = 9000;
const SAMPLER_DRIVE = 1.4;
const SCOPE_GAIN = 2;
/** Where a scope's pans start: voice v's pan is at `SCOPE_PANS + v`. */
const SCOPE_PANS = AUDIO90_VOICE_COUNT * SCOPE_POINTS;
const NOISE_SEED = 0x1234567;
const LFO_SEED = 0x2468ace;
const DEFAULT_BPM = 120;

const CHARACTER_CONSOLE = AUDIO90_CHARACTERS.indexOf('console');
const CHARACTER_SAMPLER = AUDIO90_CHARACTERS.indexOf('sampler');

const ENVS_PER_VOICE = 2 + MAX_OPERATORS;
const ENV_MOD = 1;
const ENV_OP = 2;

const SEND_COUNT = 3;
const SEND_REVERB = 0;
const SEND_ECHO = 1;
const SEND_CHORUS = 2;

const LFO_TARGETS = 5;
const LFO_PITCH = 0;
const LFO_CUTOFF = 1;
const LFO_BRIGHTNESS = 2;
const LFO_VOLUME = 3;
const LFO_PAN = 4;

const CHORUS_LINE_S = 0.05;
const CHORUS_BASE_MS = 12;
const CHORUS_SWING_MS = 6;
const MAX_CHORUS_HZ = 10;
const MAX_ECHO_MS = 2000;
const REVERB_LINES = 8;
const REVERB_LENGTHS_48K = [1031, 1327, 1523, 1871, 2053, 2311, 2647, 2887];
const DIFFUSER_LENGTHS_48K = [142, 379];
const DIFFUSER_MAX = 1024;
const DIFFUSION = 0.6;
const HADAMARD_SCALE = 1 / Math.sqrt(8);
const MIN_REVERB_DECAY_MS = 50;
const MAX_REVERB_DECAY_MS = 20000;

// The working values of one sample of the effects and the output stage
const FX_DRY_L = 0;
const FX_DRY_R = 1;
const FX_REVERB_IN = 2;
const FX_ECHO_IN_L = 3;
const FX_ECHO_IN_R = 4;
const FX_CHORUS_IN = 5;
const FX_CHORUS_L = 6;
const FX_CHORUS_R = 7;
const FX_ECHO_L = 8;
const FX_ECHO_R = 9;
const FX_ECHO_TONE_L = 10;
const FX_ECHO_TONE_R = 11;
const FX_REVERB_L = 12;
const FX_REVERB_R = 13;
const FX_DC_IN_L = 14;
const FX_DC_IN_R = 15;
const FX_DC_OUT_L = 16;
const FX_DC_OUT_R = 17;
const FX_LIMIT_L = 18;
const FX_LIMIT_R = 19;
const FX_PUMP = 20;
const FX_CHORUS_PHASE = 21;
const FX_REVERB_DAMP = 22;
const FX_LINE = FX_REVERB_DAMP + REVERB_LINES;
const FX_COUNT = FX_LINE + REVERB_LINES;

const COUNTER_SAMPLES = 0;
const COUNTER_SCOPE = 1;
const COUNTER_CHORUS = 2;
const COUNTER_ECHO = 3;
const COUNTER_COUNT = 4;

const TABLE_SIZE = 4096;
const TABLE_STRIDE = TABLE_SIZE + 1;
/** The four operator waves, one after another, each with a guard point for interpolation. */
const WAVES = buildWaves();
const SINE = WAVES.subarray(0, TABLE_STRIDE);

function buildWaves(): Float64Array {
    const waves = new Float64Array(TABLE_STRIDE * 4);
    for (let i = 0; i <= TABLE_SIZE; i++) {
        const x = i / TABLE_SIZE;
        const s = Math.sin(2 * Math.PI * x);
        waves[i] = s;
        waves[TABLE_STRIDE + i] = s > 0 ? s : 0;
        waves[TABLE_STRIDE * 2 + i] = Math.abs(s);
        waves[TABLE_STRIDE * 3 + i] = (x % 0.5) < 0.25 ? Math.abs(s) : 0;
    }
    return waves;
}
