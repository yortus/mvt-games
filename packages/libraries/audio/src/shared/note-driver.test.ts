import { describe, expect, it } from 'vitest';
import { createNoteDriver, DEFAULT_STEP_MS, type DriverInstrument, type DriverStep, type NoteDriver } from './note-driver';

describe('the note driver', () => {
    it('plays the note it is given, from the start', () => {
        const { driver } = makeDriver();
        driver.start(0, PLAIN, 57);
        driver.control(0, 0);
        expect(driver.currentNote[0]).toBe(57);
    });

    it('steps through an arpeggio, one offset a step, round and round', () => {
        const { driver } = makeDriver();
        driver.start(0, { ...PLAIN, arpeggio: [0, 4, 7] }, 60);
        expect(listNotes(driver, 5)).toEqual([60, 64, 67, 60, 64]);
    });

    it('takes each step row\'s pitch, relative or absolute, holds the last row, and hands each new row on', () => {
        const { driver, stepsSeen } = makeDriver();
        const steps: DriverStep[] = [
            { pitchMode: 'relative', pitch: 12 },
            { pitchMode: 'none', pitch: 0 },
            { pitchMode: 'absolute', pitch: 40 },
        ];
        driver.start(0, { ...PLAIN, steps }, 60);
        // A row with no pitch keeps the row before's
        expect(listNotes(driver, 5)).toEqual([72, 72, 40, 40, 40]);
        expect(stepsSeen).toEqual(steps);
    });

    it('glides from the last note to the new one over the time given', () => {
        const { driver } = makeDriver();
        driver.start(0, PLAIN, 48);
        driver.control(0, 0);
        driver.start(0, PLAIN, 60);
        driver.setGlide(0, 100);
        driver.control(0, 0);
        expect(driver.currentNote[0]).toBe(48);
        driver.control(0, toSamples(50));
        expect(driver.currentNote[0]).toBeCloseTo(54, 6);
        driver.control(0, toSamples(60));
        expect(driver.currentNote[0]).toBe(60);
    });

    it('stops a glide when the note is changed in place', () => {
        const { driver } = makeDriver();
        driver.glideBetween(0, 48, 60, 1000);
        driver.setNote(0, 62);
        driver.control(0, toSamples(10));
        expect(driver.currentNote[0]).toBe(62);
    });

    it('starts its vibrato after the delay', () => {
        const { driver } = makeDriver();
        driver.start(0, { ...PLAIN, vibratoSemitones: 1, vibratoHz: 5, vibratoDelayMs: 100 }, 60);
        driver.control(0, toSamples(50));
        expect(driver.currentNote[0]).toBe(60);
        // A quarter of a 5 Hz cycle after the delay, the vibrato is at its height
        driver.control(0, toSamples(100));
        expect(driver.currentNote[0]).toBeCloseTo(61, 6);
    });

    it('slides the pitch at its rate, until the next note', () => {
        const { driver } = makeDriver();
        driver.start(0, PLAIN, 60);
        driver.setSlide(0, 12);
        driver.control(0, toSamples(500));
        expect(driver.currentNote[0]).toBeCloseTo(66, 6);
        driver.start(0, PLAIN, 60);
        driver.control(0, toSamples(500));
        expect(driver.currentNote[0]).toBe(60);
    });

    it('ends a note with a set length once, when its time is up', () => {
        const { driver, ended } = makeDriver();
        driver.start(0, PLAIN, 60);
        driver.setLength(0, 100);
        driver.control(0, 60);
        expect(ended).toEqual([]);
        driver.control(0, 60);
        driver.control(0, 60);
        expect(ended).toEqual([0]);
    });

    it('puts a voice back at rest, at middle C', () => {
        const { driver } = makeDriver();
        driver.start(0, { ...PLAIN, arpeggio: [0, 7] }, 40);
        driver.setSlide(0, 5);
        driver.control(0, toSamples(100));
        driver.reset(0);
        driver.control(0, toSamples(100));
        expect(driver.currentNote[0]).toBe(60);
    });
});

const RATE = 48000;
const PLAIN: DriverInstrument<DriverStep> = { stepMs: 0, steps: [], arpeggio: [], vibratoSemitones: 0, vibratoHz: 0, vibratoDelayMs: 0 };

function makeDriver(): { driver: NoteDriver<DriverStep>; stepsSeen: DriverStep[]; ended: number[] } {
    const stepsSeen: DriverStep[] = [];
    const ended: number[] = [];
    const driver = createNoteDriver<DriverStep>({
        voiceCount: 2,
        sampleRate: RATE,
        onStep: (_v, step) => stepsSeen.push(step),
        onEnd: (v) => ended.push(v),
    });
    return { driver, stepsSeen, ended };
}

function toSamples(ms: number): number {
    return ms * RATE / 1000;
}

/**
 * Voice 0's note in the middle of each of its first `count` steps. A step's
 * very start may round to the end of the step before.
 */
function listNotes(driver: NoteDriver<DriverStep>, count: number): number[] {
    const notes: number[] = [];
    driver.control(0, toSamples(DEFAULT_STEP_MS / 2));
    for (let i = 0; i < count; i++) {
        notes.push(driver.currentNote[0]);
        driver.control(0, toSamples(DEFAULT_STEP_MS));
    }
    return notes;
}
