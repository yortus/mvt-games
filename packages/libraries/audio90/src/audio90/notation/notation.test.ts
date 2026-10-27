import { describe, expect, it } from 'vitest';
import { type Audio90Write, createHeadlessAudio90, render } from '../../headless';
import { computeSongDurationMs, toFrequency } from '../../shared';
import {
    AUDIO90_EFFECT_DEFAULTS,
    AUDIO90_SAMPLE_MEMORY,
    ENGINE_FM,
    ENGINE_SAMPLE,
    FILTER90_LOWPASS_24,
    LFO_SQUARE,
    WAVE90_PULSE,
} from '../synthesiser';
import type { Audio90Writer } from '../chip';
import { type Audio90Sound, createAudio90Sound, isAudio90Sound } from './sound';
import { createAudio90Sample, prepareAudio90Samples } from './sample';
import { AUDIO90_CELL_TEXT_WIDTH, formatAudio90Cell } from './format-cell';
import {
    type Audio90SongOptions,
    CELL90_ACCENT,
    CELL90_BRIGHTNESS,
    CELL90_CHORD,
    CELL90_ECHO,
    CELL90_INSTRUMENT,
    CELL90_NOTE,
    CELL90_PAN,
    CELL90_REVERB,
    CELL90_SLICE,
    CELL90_STRIDE,
    CELL90_VOLUME,
    createAudio90Song,
    isAudio90Song,
} from './song';
import { createAudio90ChannelState, writeAudio90Row, writeAudio90SongStart } from './song-writer';
import { toPan } from './tokens';

describe('the Audio90\'s notation', () => {
    describe('sounds', () => {
        it('reads an FM algorithm as which operators modulate which, and hears the rest', () => {
            const keys = createAudio90Sound({ engine: 'fm', algorithm: '2>1 4>3', operators: [{}, {}, {}, {}] });
            expect([keys.engine, STAB.engine]).toEqual(['fm', 'analog']);
            // Operator 2 (bit 1) modulates operator 1, and operator 4 (bit 3) modulates operator 3
            expect(keys.data.algorithm).toEqual([0b0010, 0, 0b1000, 0]);
            const stack = createAudio90Sound({ engine: 'fm', algorithm: '3+2>1', operators: [{}, {}, {}] });
            expect(stack.data.algorithm[0]).toBe(0b0110);
            expect(keys.data.engine).toBe(ENGINE_FM);
        });

        it('gives each operator the sound\'s release unless it has an envelope of its own', () => {
            const sound = createAudio90Sound({
                engine: 'fm',
                envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 },
                operators: [{}, { envelope: { attackMs: 0, decayMs: 100, sustain: 0, releaseMs: 50 } }],
            });
            expect(sound.data.operators[0].envelope).toEqual({ attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 300 });
            expect(sound.data.operators[1].envelope.releaseMs).toBe(50);
        });

        it('throws with the option\'s path for an operator ratio that is not a multiple of 0.5', () => {
            expect(() => createAudio90Sound({ engine: 'fm', operators: [{}, {}, {}, { ratio: 0.3 }] }))
                .toThrow('sound: operators[3].ratio: 0.3 is not a multiple of 0.5');
        });

        it('throws for an algorithm whose operator modulates a higher one, or one it does not have', () => {
            expect(() => createAudio90Sound({ engine: 'fm', algorithm: '1>2', operators: [{}, {}] })).toThrow('operator 1 cannot modulate operator 2');
            expect(() => createAudio90Sound({ engine: 'fm', algorithm: '3>1', operators: [{}, {}] })).toThrow('\'3\' is not one of its 2 operators');
        });

        it('throws for an option that belongs to another engine', () => {
            expect(() => createAudio90Sound({ engine: 'analog', operators: [{}] })).toThrow('operators is only for fm sounds, and this one is analog');
            expect(() => createAudio90Sound({ engine: 'sample' })).toThrow('a sample sound needs a sample');
        });

        it('sends the filter\'s envelope shorthand to the cutoff, and refuses it beside a mod envelope', () => {
            const squelch = createAudio90Sound({ filter: { cutoffHz: 350, resonance: 0.85, envelope: { octaves: 3, decayMs: 180 }, accent: 0.6 } });
            expect(squelch.data).toMatchObject({ filterMode: FILTER90_LOWPASS_24, cutoffHz: 350, modCutoff: 3, accent: 0.6 });
            expect(squelch.data.modEnvelope).toEqual({ attackMs: 0, decayMs: 180, sustain: 0, releaseMs: 0 });
            const envelope = { attackMs: 0, decayMs: 60, sustain: 0, releaseMs: 0 };
            expect(() => createAudio90Sound({ filter: { cutoffHz: 350, envelope: { octaves: 1 } }, modEnvelope: { to: 'pitch', amount: 24, envelope } }))
                .toThrow('give filter.envelope or modEnvelope, not both');
            expect(createAudio90Sound({ modEnvelope: { to: 'pitch', amount: 24, envelope } }).data.modPitch).toBe(24);
        });

        it('times an LFO in beats or in Hz, not both', () => {
            const gate = createAudio90Sound({ lfo: { shape: 'square', rateBeats: 1 / 4, volume: 1 } });
            expect(gate.data).toMatchObject({ lfoShape: LFO_SQUARE, lfoBeats: 0.25, lfoVolume: 1 });
            expect(() => createAudio90Sound({ lfo: { rateHz: 2, rateBeats: 1 } })).toThrow('give lfo.rateHz or lfo.rateBeats, not both');
        });

        it('makes a legato sound tie its notes, gliding over legato.glideMs', () => {
            expect(createAudio90Sound({ legato: { glideMs: 60 } }).data).toMatchObject({ isLegato: true, glideMs: 60 });
            expect(createAudio90Sound({ glideMs: 40 }).data).toMatchObject({ isLegato: false, glideMs: 40 });
            expect(() => createAudio90Sound({ glideMs: 40, legato: { glideMs: 60 } })).toThrow('give glideMs or legato.glideMs, not both');
        });

        it('reads a step table\'s Audio90 columns: wave, pitch, volume, pan, brightness and slice', () => {
            const sound = createAudio90Sound({ steps: `
                # wave  pitch  vol  pan  bright  slice
                pulse   +7     v6   P00  f9      s03
                ...
            `.replace('...', 'PFF') });
            expect(sound.data.steps[0]).toEqual({ pitchMode: 'relative', pitch: 7, volume: 6 / 15, pan: -1, brightness: 9 / 15, slice: 3, wave: WAVE90_PULSE });
            expect(sound.data.steps[1]).toMatchObject({ pitchMode: 'none', pan: 1, volume: -1, wave: -1 });
            expect(() => createAudio90Sound({ steps: 'v4 v5' })).toThrow('sound: step 0: two volumes');
        });

        it('checks each option\'s range, naming it', () => {
            expect(() => createAudio90Sound({ pan: 2 })).toThrow('sound: pan: 2 is not -1 to 1');
            expect(() => createAudio90Sound({ oscillator: { unison: 8 } })).toThrow('oscillator.unison: 8 is not a whole number from 0 to 7');
        });
    });

    describe('samples', () => {
        it('bounce a song at their own rate, with the song\'s pitch, peaking at 90% of full scale', () => {
            const sample = createAudio90Sample({ bounce: createToneSong('A-4', 8), rate: 16000, rootNote: 'A-4' });
            const { data } = sample;
            expect(data.data.length).toBe(Math.round(computeSongDurationMs(createToneSong('A-4', 8)) * 16000 / 1000));
            expect(sample.length).toBe(data.data.length);
            expect(measureHz(data.data, 16000)).toBeCloseTo(toFrequency(69), -1);
            expect(measureInt16Peak(data.data)).toBeCloseTo(0.9, 2);
            expect(data.rootNote).toBe(69);
        });

        it('bounce the same song to the same samples every time', () => {
            const song = createToneSong('C-4', 4);
            expect(createAudio90Sample({ bounce: song }).data.data).toEqual(createAudio90Sample({ bounce: song }).data.data);
        });

        it('keep only the bits asked for', () => {
            const { data } = createAudio90Sample({ bounce: createToneSong('C-4', 4), bits: 8 }).data;
            expect(data.every((value) => value % 256 === 0)).toBe(true);
        });

        it('bounce dry, unless the song sets an effect', () => {
            const wet = createAudio90Sound({ engine: 'fm', operators: [{}], reverb: 1, envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 5 } });
            const options = { bpm: 120, instruments: { W: wet }, patterns: { p: '| C-4 W\n| ===\n| ...\n| ...' }, order: ['p'] };
            const dry = createAudio90Sample({ bounce: createAudio90Song(options) }).data.data;
            const roomy = createAudio90Sample({ bounce: createAudio90Song({ ...options, reverb: { level: 1 } }) }).data.data;
            // The last row, after the note's release, is silent when dry and rings with the reverb
            const lastRow = (data: Int16Array) => measureInt16Peak(data.subarray(Math.floor(data.length * 3 / 4)));
            expect(lastRow(dry)).toBeLessThan(0.001);
            expect(lastRow(roomy)).toBeGreaterThan(0.01);
        });

        it('play in a sample sound at the pitch of the note played against their root', () => {
            const sample = createAudio90Sample({ bounce: createToneSong('A-4', 16), rootNote: 'A-4', loop: { fromMs: 100, toMs: 900 } });
            const sampler = createAudio90Sound({ engine: 'sample', sample, note: 'A-5', lengthMs: 400 });
            const { left } = render(sampler, { durationMs: 400 });
            expect(measureHz(left.subarray(4800), 48000)).toBeCloseTo(toFrequency(81), -1);
        });

        it('check their loop, slices, rate and bits', () => {
            const bounce = createToneSong('C-4', 4);
            expect(() => createAudio90Sample({ bounce, slices: 4, loop: { fromMs: 0, toMs: 100 } })).toThrow('a sliced sample cannot loop');
            expect(() => createAudio90Sample({ bounce, lengthMs: 200, loop: { fromMs: 100, toMs: 300 } })).toThrow('is not a part of the sample');
            expect(() => createAudio90Sample({ bounce, rate: 44100 })).toThrow('sample: rate: 44100 is not 8000 to 32000');
            expect(() => createAudio90Sample({ bounce, bits: 10 as 8 })).toThrow('sample: bits: 10 is not one of 8, 12, 16');
        });

        it('refuse to prepare more than the chip\'s sample memory, before bouncing any', () => {
            const bounce = createToneSong('C-4', 4);
            const rate = 32000;
            const half = createAudio90Sample({ bounce, rate, lengthMs: (AUDIO90_SAMPLE_MEMORY / 2 + 1) * 1000 / rate });
            expect(() => prepareAudio90Samples([half, half])).toThrow(`more than the chip's ${AUDIO90_SAMPLE_MEMORY}`);
        });
    });

    describe('how a sound plays on its own', () => {
        it('keeps its note, length, glide, priority and voices for a play', () => {
            const sound = createAudio90Sound({ note: 'C-3', glideTo: 'C-2', lengthMs: 400, priority: 2, maxVoices: 3, pan: -0.5, reverb: 0.5 });
            expect(sound.data).toMatchObject({ note: 48, glideTo: 36, lengthMs: 400, priority: 2, maxVoices: 3, pan: -0.5, reverb: 0.5 });
        });

        it('lasts as long as its step table by default, or 250 ms with none', () => {
            expect(createAudio90Sound({ stepMs: 20, steps: 'v8\nv4\nv2' }).data.lengthMs).toBe(60);
            expect(createAudio90Sound({}).data).toMatchObject({ lengthMs: 250, priority: 0, maxVoices: 1, glideTo: Number.NaN });
        });

        it('rejects a length of 0 or less, and a bad glide', () => {
            expect(() => createAudio90Sound({ lengthMs: 0 })).toThrow('sound: lengthMs must be above 0; got 0');
            expect(() => createAudio90Sound({ glideTo: 'H-4' })).toThrow("sound: glideTo: 'H-4' is not a note");
        });

        it('knows a sound it made', () => {
            expect(isAudio90Sound(STAB)).toBe(true);
            expect(isAudio90Sound({ ...STAB })).toBe(false);
        });
    });

    describe('songs', () => {
        it('read the Audio90\'s tokens into each cell', () => {
            const song = createAudio90Song({
                bpm: 120,
                instruments: { S: STAB },
                patterns: { p: '| A-4 S c47 P40 f4 r6 e3 ! v8' },
                order: ['p'],
            });
            const cells = song.patterns[0].cells;
            expect(cells.length).toBe(CELL90_STRIDE);
            expect([cells[CELL90_NOTE], cells[CELL90_INSTRUMENT], cells[CELL90_CHORD], cells[CELL90_PAN], cells[CELL90_BRIGHTNESS]]).toEqual([69, 0, 0x47, 0x40, 4]);
            expect([cells[CELL90_REVERB], cells[CELL90_ECHO], cells[CELL90_ACCENT], cells[CELL90_VOLUME]]).toEqual([6, 3, 1, 8]);
            expect(isAudio90Song(song)).toBe(true);
            expect(song.chip).toBe('audio90');
        });

        it('name the pattern, row and channel of a chord on an instrument that is not analog', () => {
            const piano = createAudio90Sound({ engine: 'fm', operators: [{}] });
            expect(() => createAudio90Song({ bpm: 120, instruments: { S: piano }, patterns: { drop: '| A-4 S\n| A-4 S\n| A-4 S\n| A-4 S c37' }, order: ['drop'] }))
                .toThrow('song: pattern \'drop\', row 3, channel 0: c37 needs an analog instrument, and \'S\' is fm');
        });

        it('check a token against the instrument a channel named earlier, as the order plays', () => {
            const piano = createAudio90Sound({ engine: 'fm', operators: [{}] });
            expect(() => createAudio90Song({ bpm: 120, instruments: { K: piano }, patterns: { p: '| C-4 K\n| E-4 !' }, order: ['p'] }))
                .toThrow('song: order entry 0 (\'p\'), pattern \'p\', row 1, channel 0: ! needs an analog instrument, and \'K\' is fm');
        });

        it('play a slice only of a sample instrument, and only one its sample has', () => {
            const sample = createAudio90Sample({ bounce: createToneSong('C-4', 4), slices: 4 });
            const drums = createAudio90Sound({ engine: 'sample', sample });
            expect(() => createAudio90Song({ bpm: 120, instruments: { D: drums }, patterns: { p: '| C-4 D s04' }, order: ['p'] }))
                .toThrow('s04 is past the last of the 4 slices of \'D\'\'s sample');
            expect(() => createAudio90Song({ bpm: 120, instruments: { S: STAB }, patterns: { p: '| C-4 S s00' }, order: ['p'] }))
                .toThrow('s00 needs a sample instrument, and \'S\' is analog');
            expect(createAudio90Song({ bpm: 120, instruments: { D: drums }, patterns: { p: '| C-4 D s03' }, order: ['p'] }).patterns[0].cells[CELL90_SLICE]).toBe(3);
            expect(drums.data.engine).toBe(ENGINE_SAMPLE);
        });

        it('fill the mixer for every channel, and the effects\' settings left out from the chip\'s defaults', () => {
            const song = createAudio90Song({
                ...TWO_CHANNELS,
                mixer: [{ pan: -0.4, chorus: 0.3 }],
                reverb: { size: 0.8 },
                echo: { timeBeats: 3 / 4, isPingPong: true },
                pump: { channel: 1 },
            });
            expect(song.mixer).toEqual([{ pan: -0.4, reverb: 0, echo: 0, chorus: 0.3 }, { pan: 0, reverb: 0, echo: 0, chorus: 0 }]);
            expect(song.reverb).toEqual({ ...AUDIO90_EFFECT_DEFAULTS.reverb, size: 0.8 });
            expect(song.echo).toMatchObject({ timeBeats: 0.75, isPingPong: true, feedback: AUDIO90_EFFECT_DEFAULTS.echo.feedback });
            expect(song.pump).toEqual({ channel: 1, depth: AUDIO90_EFFECT_DEFAULTS.pump.depth, releaseMs: AUDIO90_EFFECT_DEFAULTS.pump.releaseMs });
            expect(song.chorus).toBeUndefined();
        });

        it('format each cell as a tracker shows it, which parses back into the same cell', () => {
            const sample = createAudio90Sample({ bounce: createToneSong('C-4', 4), slices: 4 });
            const instruments = {
                S: STAB,
                K: createAudio90Sound({ engine: 'fm', operators: [{}], note: 'C-2' }),
                D: createAudio90Sound({ engine: 'sample', sample }),
            };
            const song = createAudio90Song({
                bpm: 120,
                instruments,
                patterns: {
                    p: `
                        | C#4 S v8 a37 P40 f4 c47 r6 e3 ! | K          | C-4 D s03
                        | ...                             | C-2 K v4   | s01
                        | E-4 ~ > u0C p8                  | ...        | ...
                        | ===                             | K e2       | ===
                        | A-4 ~46 d03 PFF                 | G#3        | D vF s02
                    `,
                },
                order: ['p'],
            });
            const pattern = song.patterns[0];
            expect(song.instrumentLetters).toEqual(['S', 'K', 'D']);
            expect(formatAudio90Cell(song, pattern, 0, 0)).toBe('C#4 S v8 a37 f4 P40 c47 r6 e3 !');
            expect(formatAudio90Cell(song, pattern, 1, 0)).toBe('...     ');
            expect(formatAudio90Cell(song, pattern, 0, 1)).toBe('... K   ');
            expect(formatAudio90Cell(song, pattern, 1, 1)).toBe('C-2 K v4');
            expect(formatAudio90Cell(song, pattern, 2, 0)).toBe('E-4      ~ > u0C p8');
            expect(formatAudio90Cell(song, pattern, 4, 0)).toBe('A-4      ~46 d03 PFF');
            expect(formatAudio90Cell(song, pattern, 0, 0).indexOf(' a37')).toBe(AUDIO90_CELL_TEXT_WIDTH);

            const rows: string[] = [];
            for (let row = 0; row < pattern.rowCount; row++) {
                const texts: string[] = [];
                for (let channel = 0; channel < song.channelCount; channel++) texts.push(formatAudio90Cell(song, pattern, row, channel));
                rows.push(`| ${texts.join(' | ')}`);
            }
            const parsed = createAudio90Song({ bpm: 120, instruments, patterns: { p: rows.join('\n') }, order: ['p'] });
            expect(Array.from(parsed.patterns[0].cells)).toEqual(Array.from(pattern.cells));
        });

        it('check the mixer, the pump, the echo and the channel count', () => {
            expect(() => createAudio90Song({ ...TWO_CHANNELS, mixer: [{}, {}, {}] })).toThrow('mixer has 3 entries, more than the song\'s 2 channels');
            expect(() => createAudio90Song({ ...TWO_CHANNELS, pump: { channel: 2 } })).toThrow('pump.channel: 2 is not one of the song\'s channels');
            expect(() => createAudio90Song({ ...TWO_CHANNELS, echo: { timeMs: 300, timeBeats: 1 } })).toThrow('give echo.timeMs or echo.timeBeats, not both');
            const seventeen = '|' + new Array(17).fill(' C-4 S ').join('|');
            expect(() => createAudio90Song({ bpm: 120, instruments: { S: STAB }, patterns: { p: seventeen }, order: ['p'] })).toThrow('17 channels is more than the chip\'s 16 voices');
        });
    });

    describe('what a song writes', () => {
        it('sets the song\'s tempo, character, effects, pump and mixer as it starts', () => {
            const audio90 = createRecordingWriter();
            const song = createAudio90Song({ ...TWO_CHANNELS, character: 'console', chorus: { level: 0.2 }, mixer: [{ pan: -1 }] });
            writeAudio90SongStart(audio90, song, createAudio90ChannelState(), 10, 1);
            expect(audio90.log).toContainEqual({ kind: 'set-tempo', bpm: 120, time: 10 });
            expect(audio90.log).toContainEqual({ kind: 'set-character', character: 'console', time: 10 });
            expect(audio90.log).toContainEqual({ kind: 'set-effect', effect: 'chorus', setting: 'level', value: 0.2, time: 10 });
            // A song with no pump turns off one a song before may have left on
            expect(audio90.log).toContainEqual({ kind: 'set-effect', effect: 'pump', setting: 'voice', value: -1, time: 10 });
            expect(audio90.log).toContainEqual({ kind: 'set-voice', voice: 0, setting: 'pan', value: -1, time: 10 });
            expect(audio90.log).toContainEqual({ kind: 'set-voice', voice: 1, setting: 'pan', value: 0, time: 10 });
            expect(audio90.log.some((write) => write.kind === 'set-effect' && write.effect === 'reverb')).toBe(false);
        });

        it('writes a row\'s channel settings before its note, and the note\'s own effects after it', () => {
            const audio90 = createRecordingWriter();
            const song = createAudio90Song({ bpm: 120, instruments: { S: STAB }, patterns: { p: '| A-4 S c47 P40 ! r6' }, order: ['p+2'] });
            writeAudio90Row(audio90, song, createAudio90ChannelState(), 0, 0, 5, 125, 1);
            expect(listKinds(audio90.log)).toEqual(['set-voice pan', 'set-voice reverbSend', 'note-on', 'set-voice accent', 'set-voice chord']);
            expect(audio90.log[0]).toMatchObject({ value: toPan(0x40), time: 5 });
            expect(audio90.log[2]).toMatchObject({ note: 71, sound: STAB });
        });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A recording headless chip, as the song writer writes to it. A recording
 * chip is its own writer, which its songs write their notes through, so the
 * cast only names what it already is.
 */
function createRecordingWriter() {
    const audio90 = createHeadlessAudio90({ record: true });
    return audio90 as typeof audio90 & Audio90Writer;
}

const STAB: Audio90Sound = createAudio90Sound({ oscillator: { wave: 'saw', unison: 3, detune: 0.2 }, filter: { cutoffHz: 3000, accent: 0.5 } });

const TWO_CHANNELS: Audio90SongOptions = { bpm: 120, instruments: { S: STAB }, patterns: { p: '| C-4 S | C-3 S' }, order: ['p'] };

/** A song of one pure tone at `note`, held for `rows` rows. */
function createToneSong(note: string, rows: number) {
    const sine = createAudio90Sound({ engine: 'fm', operators: [{}], envelope: { attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 5 } });
    const pattern = [`| ${note} T`, ...new Array<string>(rows - 1).fill('| ...')].join('\n');
    return createAudio90Song({ bpm: 120, instruments: { T: sine }, patterns: { p: pattern }, order: ['p'] });
}

/** The frequency of a steady tone, from how often it crosses zero going up. */
function measureHz(samples: ArrayLike<number>, sampleRate: number): number {
    let crossings = 0;
    let first = -1;
    let last = -1;
    for (let i = 1; i < samples.length; i++) {
        if (samples[i - 1] < 0 && samples[i] >= 0) {
            if (first < 0) first = i;
            last = i;
            crossings++;
        }
    }
    return crossings > 1 ? (crossings - 1) * sampleRate / (last - first) : 0;
}

function measureInt16Peak(data: Int16Array): number {
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    return peak / 32767;
}

/** Each write's kind, with the setting for a voice setting. */
function listKinds(log: readonly Audio90Write[]): string[] {
    return log.map((write) => (write.kind === 'set-voice' ? `set-voice ${write.setting}` : write.kind));
}
