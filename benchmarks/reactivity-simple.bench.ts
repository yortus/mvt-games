import { bench, describe } from 'vitest';
// NB: Vitest resolves solid-js to the SSR build by default (Node export
// condition) where effects and memos are inert. The test alias in
// vite.config.ts redirects to the client runtime so reactive propagation
// works the same way it does in a browser.
import { createSignal, createMemo, createRoot, batch } from 'solid-js';
import { watch } from '#common';

/*
 * ===== Reactivity Benchmarks =========================================
 *
 * Scenario: a game entity with per-tick position/speed state and an
 * infrequent wave transition - the canonical game-loop profile.
 *
 * Each approach performs equivalent work per iteration:
 *   1. Update model state (advance col, row, speed; conditionally toggle wave)
 *   2. React to changes in view (derive distance from col+row+speed; format wave label)
 *
 * Watchers: model is plain object, view polls via watch() + direct reads.
 * Signals:  model state is signals, view derives automatically via createMemo.
 * Events:   model emits on wave change, view subscribes + direct reads.
 *
 * Profile: ~3 per-tick mutations, ~1 infrequent discrete change.
 * Not covered: deep derivation chains, wide fan-out, large entity counts.
 * See docs/reactivity-guide/comparison.md for qualitative analysis.
 */

describe('Reactivity Benchmarks', () => {
    const [watcherModel, watcherView] = setupWatchers();
    const [signalsModel, signalsView, signalsCleanup] = setupSignals();
    const [eventsModel, eventsView, eventsCleanup] = setupEvents();

    bench('watcher', () => {
        watcherModel.update();
        watcherView.refresh();
    });

    bench('signals', () => {
        signalsModel.update();
        // View derives state automatically via createMemo - no manual refresh.
        void signalsView;
    });

    bench('events', () => {
        eventsModel.update();
        eventsView.refresh();
    });

    // Vitest bench mode has no teardown hooks, but the process exits immediately
    // after benchmarks finish so the leaks are harmless.
    void signalsCleanup;
    void eventsCleanup;
});

// ---------------------------------------------------------------------------
// Setup for each approach
// ---------------------------------------------------------------------------

function setupWatchers() {
    // ----- model: plain object -----
    const model = {
        col: 0,
        row: 0,
        speed: 1,
        wave: 'wave-a',
        update(ms = 16.7) {
            model.col += ms * 0.010;
            model.row += ms * 0.007;
            model.speed *= (1 + 0.001 * ms);
            if (model.speed > 1e5) {
                model.speed = 1;
                model.wave = model.wave !== 'wave-b' ? 'wave-b' : 'wave-c';
            }
        },
    };

    // ----- view: watch infrequent state, read per-tick state directly -----
    const watcher = watch({ wave: () => model.wave });
    const view = {
        distance: 0,
        waveLabel: '',
        refresh() {
            view.distance = model.col + model.row + model.speed; // dummy calc
            const watched = watcher.poll();
            if (watched.wave.changed) view.waveLabel = `=== WAVE: ${model.wave} ===`;
        },
    };

    return [model, view] as const;
}

function setupSignals() {
    // ----- model: signals are standalone - no reactive root needed -----
    const [col, setCol] = createSignal(0);
    const [row, setRow] = createSignal(0);
    const [speed, setSpeed] = createSignal(1);
    const [wave, setWave] = createSignal('wave-a');

    const model = {
        col,
        row,
        speed,
        wave,
        update(ms = 16.7) {
            batch(() => {
                setCol(col() + ms * 0.010);
                setRow(row() + ms * 0.007);
                setSpeed(speed() * (1 + 0.001 * ms));
                if (speed() > 1e5) {
                    setSpeed(1);
                    setWave(wave() !== 'wave-b' ? 'wave-b' : 'wave-c');
                }
            });
        },
    };

    // ----- view: memos need a reactive root for ownership/disposal -----
    // createMemo is the idiomatic Solid primitive for derived state.
    // In a real view, createEffect would push to the scene graph - but since
    // this benchmark has no scene graph, memos represent the derived view state.
    const [view, dispose] = createRoot((dispose) => {
        const view = {
            distance: createMemo(() => model.col() + model.row() + model.speed()), // dummy calc
            waveLabel: createMemo(() => `=== WAVE: ${model.wave()} ===`),
        };
        return [view, dispose] as const;
    });

    return [model, view, dispose] as const;
}

function setupEvents() {
    // ----- model: plain object + event dispatch for wave changes -----
    const event = new Event('wave-changed');
    const model = {
        col: 0,
        row: 0,
        speed: 1,
        wave: 'wave-a',
        waveChanged: new EventTarget(),
        update(ms = 16.7) {
            model.col += ms * 0.010;
            model.row += ms * 0.007;
            model.speed *= (1 + 0.001 * ms);
            if (model.speed > 1e5) {
                model.speed = 1;
                model.wave = model.wave !== 'wave-b' ? 'wave-b' : 'wave-c';
                model.waveChanged.dispatchEvent(event);
            }
        },
    };

    // ----- view: subscribe to discrete events, read per-tick state directly -----
    const view = {
        distance: 0,
        waveLabel: '',
        refresh() {
            view.distance = model.col + model.row + model.speed; // dummy calc
        },
    };
    const handleWaveChanged = () => view.waveLabel = `=== WAVE: ${model.wave} ===`;
    model.waveChanged.addEventListener('wave-changed', handleWaveChanged);
    const cleanup = () => model.waveChanged.removeEventListener('wave-changed', handleWaveChanged);

    return [model, view, cleanup] as const;
}
