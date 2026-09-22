import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { refreshScene, updateScene } from '../pixi-mvt';
import { createSwarmModel } from './swarm-model';
import { createSwarmView } from './swarm-view';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const FIELD_WIDTH = 960;
const FIELD_HEIGHT = 600;

main();

async function main(): Promise<void> {
    const app = new Application();
    await app.init({
        width: FIELD_WIDTH,
        height: FIELD_HEIGHT,
        backgroundColor: 0x0d1117,
        antialias: true,
    });
    document.getElementById('stage')!.appendChild(app.canvas);

    // ---- Model ------------------------------------------------------------
    const swarm = createSwarmModel({ spawnRate: 160, initialCount: 500 });

    // ---- Scene ------------------------------------------------------------
    // A three-deep chain so the order probe below has something to prove.
    const field = new Container();
    field.label = 'field';
    app.stage.addChild(field);

    const camera = createCameraView();
    field.addChild(camera);

    camera.addChild(createSwarmView({
        getEntities: () => swarm.entities,
        getFieldWidth: () => FIELD_WIDTH,
        getFieldHeight: () => FIELD_HEIGHT,
    }));

    const probe = createOrderProbe(field);
    const timings = createPassTimings();
    const hud = createHudView({
        getEntityCount: () => swarm.entities.length,
        getSpawnRate: () => swarm.spawnRate,
        getFps: () => app.ticker.FPS,
        getUpdateMicros: () => timings.updateMicros,
        getRefreshMicros: () => timings.refreshMicros,
        getProbeTrace: () => probe.trace,
    });
    app.stage.addChild(hud);

    // ---- Controls ---------------------------------------------------------
    wireControls(swarm);

    // ---- Loop -------------------------------------------------------------
    // The whole frame, in one place, subscribed to nothing behind your back.
    app.ticker.add((ticker) => {
        const deltaMs = ticker.deltaMS;
        swarm.update(deltaMs);                        // models advance
        timings.runUpdate(app.stage, deltaMs);        // views advance their own state
        timings.runRefresh(app.stage);                // views sync from models
        probe.endFrame();
    });
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/**
 * Holds cosmetic state the model does not track (a slow drift), advances it in
 * `onUpdate`, and applies it in `onRefresh`. Its descendants are refreshed
 * after it, so they see the transform this tick, not last tick's.
 */
function createCameraView(): Container {
    const view = new Container();
    view.label = 'camera';

    let driftMs = 0;

    view.onUpdate = (deltaMs) => {
        driftMs += deltaMs;
    };

    view.onRefresh = () => {
        view.scale.set(1 + Math.sin(driftMs * 0.0004) * 0.08);
        view.pivot.set(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
        view.position.set(FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
        view.rotation = Math.sin(driftMs * 0.00021) * 0.05;
    };

    return view;
}

interface HudBindings {
    getEntityCount(): number;
    getSpawnRate(): number;
    getFps(): number;
    getUpdateMicros(): number;
    getRefreshMicros(): number;
    getProbeTrace(): string;
}

function createHudView(bindings: HudBindings): Container {
    const view = new Container();
    view.label = 'hud';

    const panel = new Graphics();
    panel.roundRect(0, 0, 360, 176, 8).fill({ color: 0x161b22, alpha: 0.88 });
    panel.position.set(12, 12);
    view.addChild(panel);

    const style = new TextStyle({
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: 13,
        fill: 0xc9d1d9,
        lineHeight: 19,
    });
    const text = new Text({ text: '', style });
    text.position.set(26, 26);
    view.addChild(text);

    view.onRefresh = () => {
        text.text = [
            `fps           ${bindings.getFps().toFixed(0)}`,
            `entities      ${bindings.getEntityCount()}`,
            `spawn rate    ${bindings.getSpawnRate().toFixed(0)}/s`,
            `update pass   ${bindings.getUpdateMicros().toFixed(0)} us`,
            `refresh pass  ${bindings.getRefreshMicros().toFixed(0)} us`,
            `probe order   ${bindings.getProbeTrace()}`,
        ].join('\n');
    };

    return view;
}

// ---------------------------------------------------------------------------
// Pass timings
// ---------------------------------------------------------------------------

interface PassTimings {
    readonly updateMicros: number;
    readonly refreshMicros: number;
    /** Runs `updateScene` and records what it cost. */
    runUpdate(stage: Container, deltaMs: number): void;
    /** Runs `refreshScene` and records what it cost. */
    runRefresh(stage: Container): void;
}

/**
 * Times each pass and smooths the result, so the cost of driving a churning
 * scene of a few thousand containers is visible on screen.
 */
function createPassTimings(): PassTimings {
    let updateMicros = 0;
    let refreshMicros = 0;

    return {
        get updateMicros(): number {
            return updateMicros;
        },
        get refreshMicros(): number {
            return refreshMicros;
        },
        runUpdate(stage: Container, deltaMs: number): void {
            const start = performance.now();
            updateScene(stage, deltaMs);
            updateMicros += ((performance.now() - start) * 1000 - updateMicros) * SMOOTHING;
        },
        runRefresh(stage: Container): void {
            const start = performance.now();
            refreshScene(stage);
            refreshMicros += ((performance.now() - start) * 1000 - refreshMicros) * SMOOTHING;
        },
    };
}

// ---------------------------------------------------------------------------
// Order probe
// ---------------------------------------------------------------------------

interface OrderProbe {
    readonly trace: string;
    endFrame(): void;
}

/**
 * A four-deep chain of containers that records the order its refresh methods
 * fire in, so the ordering guarantee is visible on screen rather than only in a
 * test. The links carry no drawables, so they cost nothing to keep in the
 * refresh walk.
 */
function createOrderProbe(parent: Container): OrderProbe {
    const recorded: string[] = [];
    let trace = '';

    const links: Container[] = [];
    let cursor = parent;
    const labels = ['p1', 'p2', 'p3', 'p4'];
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const link = new Container();
        link.label = label;
        // p2 deliberately starts with no refresh method.
        if (label !== 'p2') link.onRefresh = () => void recorded.push(label);
        cursor.addChild(link);
        links.push(link);
        cursor = link;
    }

    // Given a refresh method only after the chain is attached, so p3 and p4 are
    // already listed. An append-ordered scheme such as Pixi's own `onRender`
    // list would call p2 last; the trace on screen shows it in tree position.
    links[1].onRefresh = () => void recorded.push('p2');

    return {
        get trace(): string {
            return trace;
        },
        endFrame(): void {
            trace = recorded.join(' > ');
            recorded.length = 0;
        },
    };
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function wireControls(swarm: { spawnRate: number }): void {
    const rate = document.getElementById('spawn-rate') as HTMLInputElement | undefined;
    const rateLabel = document.getElementById('spawn-rate-label');
    if (rate) {
        rate.value = String(swarm.spawnRate);
        rate.addEventListener('input', () => {
            swarm.spawnRate = Number(rate.value);
            if (rateLabel) rateLabel.textContent = `${rate.value}/s`;
        });
        if (rateLabel) rateLabel.textContent = `${rate.value}/s`;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How much of each frame's measurement the displayed figure takes on. */
const SMOOTHING = 0.1;
