import { type Renderer, RendererType, type Ticker } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFrameStats, type SampledCounter } from './frame-stats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A stand-in application: a ticker whose listener the test calls, and a
 * renderer whose render hooks the test calls. Without `gl` the renderer is
 * not WebGL, so there is no GPU timing. The clock is `performance.now`,
 * stepped by hand.
 */
function setup(readCounter?: SampledCounter, gl?: FakeGl) {
    let nowMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    let onTick: (() => void) | undefined;
    const hooks: { prerender(): void; postrender(): void }[] = [];
    const ticker = {
        add: (fn: () => void) => { onTick = fn; },
        remove: () => { onTick = undefined; },
    } as unknown as Ticker;
    const runner = {
        add: (item: { prerender(): void; postrender(): void }) => { if (!hooks.includes(item)) hooks.push(item); },
        remove: () => undefined,
    };
    const renderer = {
        type: gl === undefined ? RendererType.WEBGPU : RendererType.WEBGL,
        gl,
        runners: { prerender: runner, postrender: runner },
    } as unknown as Renderer;

    const stats = createFrameStats({ renderer, ticker, windowMs: 100, readCounter });

    /** One frame: tick, `work` (the frame's update and refresh), render; `frameMs` of it busy, the rest idle. */
    function frame(frameMs: number, busyMs: number, work?: () => void): void {
        onTick!();
        work?.();
        nowMs += busyMs;
        for (const h of hooks) h.prerender();
        for (const h of hooks) h.postrender();
        nowMs += frameMs - busyMs;
    }

    return { stats, frame };
}

/**
 * Just enough of a WebGL 2 context with `EXT_disjoint_timer_query_webgl2`. Each
 * query's result is the next of `resultsMs`, stamped when the query begins,
 * and readable while `areResultsAvailable`. `isDisjoint` is the extension's
 * flag, cleared when read.
 */
interface FakeGl {
    areResultsAvailable: boolean;
    isDisjoint: boolean;
}

interface FakeQuery { ns: number }

const TIMER_EXTENSION = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
const QUERY_RESULT = 0x8866;
const QUERY_RESULT_AVAILABLE = 0x8867;

/** Stands in for `WebGL2RenderingContext`, which Node lacks, so a fake passes the `instanceof` check. */
const FakeWebGl2Context = function FakeWebGl2Context() { /* never constructed */ };

function createFakeGl(resultsMs: number[]): FakeGl {
    (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext = FakeWebGl2Context;
    const gl = Object.create(FakeWebGl2Context.prototype) as FakeGl & Record<string, unknown>;
    return Object.assign(gl, {
        QUERY_RESULT,
        QUERY_RESULT_AVAILABLE,
        areResultsAvailable: true,
        isDisjoint: false,
        getExtension: () => TIMER_EXTENSION,
        createQuery: (): FakeQuery => ({ ns: 0 }),
        deleteQuery: () => undefined,
        beginQuery: (_target: number, query: FakeQuery) => {
            query.ns = (resultsMs.shift() ?? 0) * 1e6;
        },
        endQuery: () => undefined,
        getQueryParameter: (query: FakeQuery, name: number) => (
            name === QUERY_RESULT_AVAILABLE ? gl.areResultsAvailable : query.ns
        ),
        getParameter: (name: number) => {
            if (name !== TIMER_EXTENSION.GPU_DISJOINT_EXT) return undefined;
            const wasDisjoint = gl.isDisjoint;
            gl.isDisjoint = false;
            return wasDisjoint;
        },
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('frame stats', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext;
    });

    it('publishes frames per second and CPU time per frame at the end of each window', () => {
        const { stats, frame } = setup();

        for (let i = 0; i < 12; i++) frame(10, 4);

        expect(stats.sampleCount).toBeGreaterThan(0);
        expect(stats.fps).toBeCloseTo(100, 0);
        expect(stats.cpuMs).toBeCloseTo(4, 5);
        expect(stats.gpuMs).toBeUndefined();
        expect(stats.readsPerFrame).toBeUndefined();
    });

    it('reports the median GPU time of each window, so a few inflated frames do not dominate', () => {
        // Ten frames of 0.5 ms with two inflated to 8 ms: the mean would be 1.7 ms
        const gl = createFakeGl([0.5, 0.5, 8, 0.5, 0.5, 0.5, 8, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
        const { stats, frame } = setup(undefined, gl);

        for (let i = 0; i < 12; i++) frame(10, 4);

        expect(stats.gpuMs).toBe(0.5);
    });

    it('drops every result in flight after a disjoint event', () => {
        const gl = createFakeGl([9, 9, 9, 9, 9, ...new Array<number>(20).fill(1)]);
        const { stats, frame } = setup(undefined, gl);

        // Five frames timed at 9 ms, still in flight when a disjoint event
        // happens; then frames at 1 ms, collected normally
        gl.areResultsAvailable = false;
        for (let i = 0; i < 5; i++) frame(10, 4);
        gl.isDisjoint = true;
        gl.areResultsAvailable = true;
        for (let i = 0; i < 20; i++) frame(10, 4);

        expect(stats.gpuMs).toBe(1);
        const history: number[] = [];
        for (let i = 0; i < stats.historyLength; i++) history.push(stats.historyAt('gpu', i));
        expect(history).not.toContain(9);
    });

    it('counts reads for one frame per window, and leaves the counter off otherwise', () => {
        const counter = { isCounting: false, count: 0 };
        const { stats, frame } = setup(counter);
        const read = (): void => {
            if (counter.isCounting) counter.count += 250;
        };

        let countingFrames = 0;
        for (let i = 0; i < 40; i++) {
            frame(10, 4, () => {
                if (counter.isCounting) countingFrames++;
                read();
            });
        }

        expect(stats.readsPerFrame).toBe(250);
        // About one frame in each 100 ms window of 10 ms frames
        expect(countingFrames).toBeGreaterThanOrEqual(3);
        expect(countingFrames).toBeLessThanOrEqual(4);

        stats.destroy();
        expect(counter.isCounting).toBe(false);
    });
});
