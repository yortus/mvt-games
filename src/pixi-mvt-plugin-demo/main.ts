import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { installMvtScenePlugin } from '../pixi-mvt-plugin';
import type { SchedulerStrategyKind } from '../pixi-mvt-plugin';
import { createSwarmModel } from './swarm-model';
import { createSwarmView } from './swarm-view';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const FIELD_WIDTH = 960;
const FIELD_HEIGHT = 600;

main();

async function main(): Promise<void> {
    const strategy = readStrategy();

    // The plugin has to be registered before `init`, which is when Pixi runs
    // application plugins.
    installMvtScenePlugin();

    const app = new Application();
    await app.init({
        width: FIELD_WIDTH,
        height: FIELD_HEIGHT,
        backgroundColor: 0x0d1117,
        antialias: true,
        mvtStrategy: strategy,
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
    const hud = createHudView({
        getStrategy: () => strategy,
        getEntityCount: () => swarm.entities.length,
        getSpawnRate: () => swarm.spawnRate,
        getFps: () => app.ticker.FPS,
        getStats: () => app.scene.stats,
        getProbeTrace: () => probe.trace,
    });
    app.stage.addChild(hud);

    // ---- Controls ---------------------------------------------------------
    wireControls(strategy, swarm);

    // ---- Loop -------------------------------------------------------------
    // The whole point of the ports-and-adapters split: the frame is three
    // explicit calls in one place, and nothing is subscribed behind your back.
    app.ticker.add((ticker) => {
        const deltaMs = ticker.deltaMS;
        swarm.update(deltaMs);      // models advance
        app.scene.update(deltaMs);  // views advance their presentation state
        app.scene.refresh();        // views sync from models
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
    getStrategy(): SchedulerStrategyKind;
    getEntityCount(): number;
    getSpawnRate(): number;
    getFps(): number;
    getStats(): {
        readonly updateCalls: number;
        readonly refreshCalls: number;
        readonly rebuilds: number;
        readonly compactions: number;
        readonly drainRounds: number;
    };
    getProbeTrace(): string;
}

function createHudView(bindings: HudBindings): Container {
    const view = new Container();
    view.label = 'hud';

    const panel = new Graphics();
    panel.roundRect(0, 0, 360, 214, 8).fill({ color: 0x161b22, alpha: 0.88 });
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
        const stats = bindings.getStats();
        text.text = [
            `strategy      ${bindings.getStrategy()}`,
            `fps           ${bindings.getFps().toFixed(0)}`,
            `entities      ${bindings.getEntityCount()}`,
            `spawn rate    ${bindings.getSpawnRate().toFixed(0)}/s`,
            `update calls  ${stats.updateCalls}`,
            `refresh calls ${stats.refreshCalls}`,
            `rebuilds      ${stats.rebuilds}`,
            `compactions   ${stats.compactions}`,
            `drain rounds  ${stats.drainRounds}`,
            `probe order   ${bindings.getProbeTrace()}`,
        ].join('\n');
    };

    return view;
}

// ---------------------------------------------------------------------------
// Order probe
// ---------------------------------------------------------------------------

interface OrderProbe {
    readonly trace: string;
    endFrame(): void;
}

/**
 * A four-deep chain of containers that records the order its hooks fire in, so
 * the ordering guarantee is visible on screen rather than only in a test.
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
        // Never drawn, and refreshed anyway: neither pass is gated on
        // visibility, culling or whether a render even happened.
        link.visible = false;
        // p2 deliberately starts with no hook.
        if (label !== 'p2') link.onRefresh = () => recorded.push(label);
        cursor.addChild(link);
        links.push(link);
        cursor = link;
    }

    // Hooked only after the chain is attached, so p3 and p4 are already in the
    // call list. An append-ordered scheme such as Pixi's own `onRender` list
    // would call p2 last; the trace on screen shows it in tree position.
    links[1].onRefresh = () => recorded.push('p2');

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

function readStrategy(): SchedulerStrategyKind {
    const raw = new URLSearchParams(location.search).get('strategy');
    return raw === 'rebuild' ? 'rebuild' : 'incremental';
}

function wireControls(strategy: SchedulerStrategyKind, swarm: { spawnRate: number }): void {
    const toggle = document.getElementById('toggle-strategy') as HTMLButtonElement | undefined;
    if (toggle) {
        toggle.textContent = strategy === 'incremental'
            ? 'Switch to rebuild strategy'
            : 'Switch to incremental strategy';
        toggle.addEventListener('click', () => {
            const next = strategy === 'incremental' ? 'rebuild' : 'incremental';
            location.search = `?strategy=${next}`;
        });
    }

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
