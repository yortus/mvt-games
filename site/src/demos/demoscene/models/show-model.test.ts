import { describe, expect, it } from 'vitest';
import { MS_PER_BAR, SHOW_SCRIPT } from '../data';
import { createShowModel, type ShowModel } from './show-model';
import { BALLS_PER_RING, MIN_RING_GAP_ROWS, RING_COUNT } from './sprites-part-model';

describe('ShowModel', () => {
    it('plays the script once, then loops', () => {
        const show = createShowModel();
        const scriptBars = SHOW_SCRIPT.reduce((bars, part) => bars + part.bars, 0);
        expect(show.loopMs).toBe(scriptBars * MS_PER_BAR);
        show.update(show.loopMs + 1000);
        expect(show.timeMs).toBeCloseTo(1000);
        expect(show.part).toBe(SHOW_SCRIPT[0].part);
    });

    it('starts every part on a bar line, in script order', () => {
        const show = createShowModel();
        let bars = 0;
        for (let i = 0; i < SHOW_SCRIPT.length; i++) {
            show.seek(bars * MS_PER_BAR);
            expect(show.part).toBe(SHOW_SCRIPT[i].part);
            expect(show.partElapsedMs).toBe(0);
            show.seek(bars * MS_PER_BAR - 1);
            expect(show.partIndex).toBe(i === 0 ? SHOW_SCRIPT.length - 1 : i - 1);
            bars += SHOW_SCRIPT[i].bars;
        }
    });

    it('is black at every change of part', () => {
        const show = createShowModel();
        let bars = 0;
        for (let i = 0; i < SHOW_SCRIPT.length; i++) {
            show.seek(bars * MS_PER_BAR);
            expect(show.brightness).toBe(0);
            show.seek(bars * MS_PER_BAR + MS_PER_BAR);
            expect(show.brightness).toBe(1);
            bars += SHOW_SCRIPT[i].bars;
        }
    });

    it('agrees whether it seeks or plays to a time', () => {
        const played = createShowModel();
        const sought = createShowModel();
        // Uneven steps, as a real display gives, through the whole show and into the next loop
        let step = 0;
        while (played.timeMs < played.loopMs - 50) {
            const before = played.timeMs;
            played.update(7 + ((step * 13) % 23));
            if (played.timeMs < before) break;
            step++;
            if (step % 97 !== 0) continue;
            sought.seek(played.timeMs);
            expect(snapshot(sought)).toEqual(snapshot(played));
        }
        expect(step).toBeGreaterThan(5000);
    });

    it('stands still while paused', () => {
        const show = createShowModel({ startMs: 5000 });
        show.togglePause();
        show.update(1000);
        expect(show.timeMs).toBe(5000);
        expect(show.isPaused).toBe(true);
        show.togglePause();
        show.update(1000);
        expect(show.timeMs).toBe(6000);
    });

    it('skips forward and back by parts, round the loop', () => {
        const show = createShowModel({ startMs: 1000 });
        show.skipParts(1);
        expect(show.part).toBe(SHOW_SCRIPT[1].part);
        expect(show.partElapsedMs).toBe(0);
        show.skipParts(-2);
        expect(show.part).toBe(SHOW_SCRIPT[SHOW_SCRIPT.length - 1].part);
        show.skipParts(1);
        expect(show.part).toBe(SHOW_SCRIPT[0].part);
    });

    it('flashes on the first beat of every bar', () => {
        const show = createShowModel({ startMs: MS_PER_BAR * 20 });
        expect(show.barFlash).toBe(1);
        show.update(MS_PER_BAR / 8);
        expect(show.barFlash).toBeCloseTo(0.5);
        show.update(MS_PER_BAR / 4);
        expect(show.barFlash).toBe(0);
    });

    it('keeps the sprite rings far enough apart for the multiplexer, all through the part', () => {
        const show = createShowModel();
        show.skipParts(SHOW_SCRIPT.findIndex((s) => s.part === 'sprites'));
        const end = show.timeMs + show.partDurationMs;
        for (let t = show.timeMs; t < end; t += 40) {
            show.seek(t);
            for (let ring = 1; ring < RING_COUNT; ring++) {
                const above = show.sprites.ballRowAt((ring - 1) * BALLS_PER_RING);
                const below = show.sprites.ballRowAt(ring * BALLS_PER_RING);
                expect(below - above).toBeGreaterThanOrEqual(MIN_RING_GAP_ROWS - 1e-9);
                // Every ball in a ring at the same height
                for (let i = 1; i < BALLS_PER_RING; i++) {
                    expect(show.sprites.ballRowAt(ring * BALLS_PER_RING + i)).toBe(below);
                }
            }
        }
    });

    it('lands the logo, then lets it wobble', () => {
        const show = createShowModel();
        show.skipParts(SHOW_SCRIPT.findIndex((s) => s.part === 'logo'));
        expect(show.logo.dropRows).toBeGreaterThan(0);
        expect(show.logo.wobbleCols).toBe(0);
        show.update(MS_PER_BAR * 2);
        expect(show.logo.dropRows).toBe(0);
        show.update(MS_PER_BAR * 2);
        expect(show.logo.wobbleCols).toBeGreaterThan(0);
    });

    it('scrolls the credits from below the screen to their last line', () => {
        const show = createShowModel();
        show.skipParts(SHOW_SCRIPT.findIndex((s) => s.part === 'credits'));
        // All 25 of the screen's rows below the text
        expect(show.credits.scrollRows).toBe(-25);
        show.update(show.partDurationMs - 1);
        expect(show.credits.scrollRows).toBeGreaterThan(0);
    });
});

/** Everything the show exposes at one moment, from every part. */
function snapshot(show: ShowModel): Record<string, number | string | boolean> {
    const values: Record<string, number | string | boolean> = {
        timeMs: show.timeMs,
        part: show.part,
        beat: show.beat,
        barFlash: show.barFlash,
        brightness: show.brightness,
        partProgress: show.partProgress,
        bootPhase: show.boot.phase,
        typed: show.boot.typedCount,
        cursor: show.boot.isCursorOn,
        loadingFrame: show.boot.loadingFrame,
        caption: show.intro.captionIndex,
        captionBrightness: show.intro.captionBrightness,
        drop: show.logo.dropRows,
        wobble: show.logo.wobbleCols,
        wobblePhase: show.logo.wobblePhase,
        scroller: show.logo.scrollerOffset,
        plasmaA: show.plasma.phaseA,
        dycp: show.plasma.dycpOffset,
        yaw: show.vectors.yaw,
        distance: show.vectors.distance,
        morph: show.sprites.morph,
        credits: show.credits.scrollRows,
    };
    for (let i = 0; i < show.intro.barCount; i++) values[`introBar${i}`] = show.intro.barRowAt(i);
    for (let i = 0; i < show.logo.barCount; i++) values[`logoBar${i}`] = show.logo.barRowAt(i);
    for (let i = 0; i < show.vectors.starCount; i += 7) values[`star${i}`] = show.vectors.starColAt(i);
    for (let i = 0; i < show.sprites.ballCount; i += 5) {
        values[`ballCol${i}`] = show.sprites.ballColAt(i);
        values[`ballRow${i}`] = show.sprites.ballRowAt(i);
    }
    return values;
}
