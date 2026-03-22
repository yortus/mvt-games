// ---------------------------------------------------------------------------
// Preset examples for the MVT Playground
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Preset {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly modelCode: string;
    readonly viewCode: string;
    readonly canvasWidth?: number;
    readonly canvasHeight?: number;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const bouncingBall: Preset = {
    id: 'bouncing-ball',
    name: 'Bouncing Ball',
    description: 'A ball with gravity and friction. Click and drag to grab, move, and throw it. Demonstrates physics, mouse input, and interactive Graphics rendering.',
    canvasWidth: 400,
    canvasHeight: 300,
    modelCode: `// Bouncing Ball - Model
// Simulates gravity and friction. Supports grab, drag, and throw.

interface BallModel {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly held: boolean;
    grab(px: number, py: number): void;
    drag(px: number, py: number): void;
    release(): void;
    update(deltaMs: number): void;
}

function createModel(): BallModel {
    const radius = 15;
    const gravity = 0.0015;    // px/ms^2
    const bounce = 0.7;        // energy retained on bounce
    const friction = 0.998;    // per-ms velocity damping
    const W = 400;
    const H = 300;

    let x = 200;
    let y = 100;
    let vx = 0.12;
    let vy = 0;
    let held = false;

    // Velocity tracking for throw - store recent positions
    let prevDragX = 0;
    let prevDragY = 0;
    let dragDt = 0;

    return {
        get x() { return x; },
        get y() { return y; },
        get radius() { return radius; },
        get held() { return held; },

        grab(px: number, py: number) {
            const dx = px - x;
            const dy = py - y;
            if (dx * dx + dy * dy <= (radius + 8) * (radius + 8)) {
                held = true;
                vx = 0;
                vy = 0;
                prevDragX = px;
                prevDragY = py;
                dragDt = 0;
            }
        },

        drag(px: number, py: number) {
            if (!held) return;
            prevDragX = x;
            prevDragY = y;
            x = px;
            y = py;
            // Clamp inside bounds
            x = Math.max(radius, Math.min(W - radius, x));
            y = Math.max(radius, Math.min(H - radius, y));
        },

        release() {
            if (!held) return;
            held = false;
            // Throw velocity from recent movement
            if (dragDt > 0) {
                vx = (x - prevDragX) / dragDt;
                vy = (y - prevDragY) / dragDt;
            }
        },

        update(deltaMs: number) {
            if (held) {
                dragDt = deltaMs;
                return;
            }

            // Apply gravity
            vy += gravity * deltaMs;

            // Apply friction
            const f = Math.pow(friction, deltaMs);
            vx *= f;
            vy *= f;

            // Integrate position
            x += vx * deltaMs;
            y += vy * deltaMs;

            // Bounce off walls
            if (x - radius < 0)     { x = radius;         vx = Math.abs(vx) * bounce; }
            if (x + radius > W)     { x = W - radius;     vx = -Math.abs(vx) * bounce; }
            if (y - radius < 0)     { y = radius;         vy = Math.abs(vy) * bounce; }
            if (y + radius > H)     { y = H - radius;     vy = -Math.abs(vy) * bounce; }

            // Stop micro-bouncing
            if (y + radius >= H - 1 && Math.abs(vy) < 0.01) {
                vy = 0;
                y = H - radius;
            }
        },
    };
}
`,
    viewCode: `// Bouncing Ball - View
// Draws the ball and handles mouse interaction for grab/drag/throw.

function createView(model: any): any {
    setBackground(0x0a1628);
    const view = new Container();
    const gfx = new Graphics();
    view.addChild(gfx);

    const shadow = new Graphics();
    view.addChildAt(shadow, 0);

    // Make the whole area interactive for drag/release
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, 400, 300);

    view.on('pointerdown', (e: any) => {
        model.grab(e.globalX, e.globalY);
    });
    view.on('pointermove', (e: any) => {
        model.drag(e.globalX, e.globalY);
    });
    view.on('pointerup', () => {
        model.release();
    });
    view.on('pointerupoutside', () => {
        model.release();
    });

    drawBall(false);
    view.onRender = refresh;
    return view;

    function refresh(): void {
        gfx.position.set(model.x, model.y);

        // Shadow on ground
        shadow.clear();
        const groundY = 300 - model.radius * 0.3;
        const shadowScale = 1 - (300 - model.y) / 400;
        const sr = model.radius * (0.6 + 0.4 * shadowScale);
        shadow.ellipse(model.x, groundY, sr, model.radius * 0.2);
        shadow.fill({ color: 0x000000, alpha: 0.25 * (0.3 + 0.7 * shadowScale) });

        drawBall(model.held);
    }

    function drawBall(held: boolean): void {
        gfx.clear();
        gfx.circle(0, 0, model.radius);
        gfx.fill(held ? 0x66ccff : 0x44aaff);
        // Highlight
        gfx.circle(-4, -4, model.radius * 0.35);
        gfx.fill({ color: 0xffffff, alpha: 0.4 });
        if (held) {
            gfx.circle(0, 0, model.radius + 3);
            gfx.stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 });
        }
    }
}
`,
};

const scoreCounter: Preset = {
    id: 'score-counter',
    name: 'Click Frenzy',
    description: 'Click targets to score points. Hit streaks build a combo multiplier that decays over time. Demonstrates mouse input, timed state, and text rendering.',
    canvasWidth: 400,
    canvasHeight: 300,
    modelCode: `// Click Frenzy - Model
// Targets appear at random positions. Clicking one scores points
// multiplied by a combo that builds with consecutive hits and
// decays if you're too slow.

interface Target {
    x: number;
    y: number;
    radius: number;
    age: number;
    lifespan: number;
}

interface FrenzyModel {
    readonly score: number;
    readonly combo: number;
    readonly targets: readonly Target[];
    readonly lastHitAge: number;
    hit(x: number, y: number): boolean;
    update(deltaMs: number): void;
}

function createModel(): FrenzyModel {
    let score = 0;
    let combo = 0;
    let lastHitAge = 0;
    let spawnTimer = 0;
    const targets: Target[] = [];
    const spawnInterval = 900;
    const comboDecayTime = 2000;

    function spawnTarget(): void {
        targets.push({
            x: 30 + Math.random() * 340,
            y: 30 + Math.random() * 240,
            radius: 14 + Math.random() * 10,
            age: 0,
            lifespan: 2500 + Math.random() * 1500,
        });
    }

    // Start with a couple of targets
    spawnTarget();
    spawnTarget();

    return {
        get score() { return score; },
        get combo() { return combo; },
        get targets() { return targets; },
        get lastHitAge() { return lastHitAge; },

        hit(hx: number, hy: number): boolean {
            for (let i = targets.length - 1; i >= 0; i--) {
                const t = targets[i];
                const dx = hx - t.x;
                const dy = hy - t.y;
                if (dx * dx + dy * dy <= t.radius * t.radius) {
                    targets.splice(i, 1);
                    combo++;
                    lastHitAge = 0;
                    score += 10 * combo;
                    return true;
                }
            }
            // Missed - reset combo
            if (combo > 0) {
                combo = 0;
            }
            return false;
        },

        update(deltaMs: number) {
            lastHitAge += deltaMs;

            // Decay combo after inactivity
            if (combo > 0 && lastHitAge > comboDecayTime) {
                combo = 0;
            }

            // Age targets and remove expired ones
            for (let i = targets.length - 1; i >= 0; i--) {
                targets[i].age += deltaMs;
                if (targets[i].age >= targets[i].lifespan) {
                    targets.splice(i, 1);
                    combo = 0; // missed target breaks combo
                }
            }

            // Spawn new targets
            spawnTimer += deltaMs;
            if (spawnTimer >= spawnInterval) {
                spawnTimer -= spawnInterval;
                if (targets.length < 5) spawnTarget();
            }
        },
    };
}
`,
    viewCode: `// Click Frenzy - View
// Renders targets as pulsing circles and displays score/combo.

function createView(model: any): any {
    setBackground(0x1a0a24);
    const view = new Container();

    // Score display
    const scoreText = new Text({
        text: '0',
        style: { fontFamily: 'monospace', fontSize: 32, fill: 0x44ff44, fontWeight: 'bold' },
    });
    scoreText.position.set(10, 8);
    view.addChild(scoreText);

    // Combo display
    const comboText = new Text({
        text: '',
        style: { fontFamily: 'monospace', fontSize: 18, fill: 0xffaa00 },
    });
    comboText.position.set(10, 46);
    view.addChild(comboText);

    // Target graphics container
    const targetLayer = new Container();
    view.addChild(targetLayer);

    // Click handler
    view.eventMode = 'static';
    view.hitArea = new Rectangle(0, 0, 400, 300);
    view.on('pointerdown', (e: any) => {
        model.hit(e.globalX, e.globalY);
    });

    view.onRender = refresh;
    return view;

    function refresh(): void {
        scoreText.text = String(model.score);
        comboText.text = model.combo > 1 ? model.combo + 'x COMBO' : '';

        // Rebuild target visuals
        while (targetLayer.children.length > model.targets.length) {
            const c = targetLayer.children[targetLayer.children.length - 1];
            targetLayer.removeChild(c);
            c.destroy();
        }
        while (targetLayer.children.length < model.targets.length) {
            targetLayer.addChild(new Graphics());
        }

        for (let i = 0; i < model.targets.length; i++) {
            const t = model.targets[i];
            const gfx = targetLayer.children[i] as any;
            const life = 1 - t.age / t.lifespan;
            const pulse = 1 + 0.08 * Math.sin(t.age * 0.008);
            const r = t.radius * pulse;

            gfx.clear();
            // Outer ring
            gfx.circle(t.x, t.y, r + 3);
            gfx.fill({ color: 0xff4466, alpha: life * 0.3 });
            // Inner target
            gfx.circle(t.x, t.y, r);
            gfx.fill({ color: 0xff4466, alpha: 0.4 + life * 0.6 });
            // Bullseye
            gfx.circle(t.x, t.y, r * 0.4);
            gfx.fill({ color: 0xffffff, alpha: 0.7 });
        }
    }
}
`,
};

const trafficLight: Preset = {
    id: 'traffic-light',
    name: 'Traffic Light',
    description: 'Cycles through red/yellow/green phases on a timer. Demonstrates state machines and the watch() utility.',
    canvasWidth: 200,
    canvasHeight: 400,
    modelCode: `// Traffic Light - Model
// Cycles through phases: green (3s) -> yellow (1s) -> red (3s) -> ...

type Phase = 'red' | 'yellow' | 'green';

interface TrafficModel {
    readonly phase: Phase;
    update(deltaMs: number): void;
}

function createModel(): TrafficModel {
    const durations: Record<Phase, number> = {
        green: 3000,
        yellow: 1000,
        red: 3000,
    };
    const order: Phase[] = ['green', 'yellow', 'red'];

    let phaseIndex = 0;
    let phase: Phase = order[0];
    let elapsed = 0;

    return {
        get phase() { return phase; },

        update(deltaMs: number) {
            elapsed += deltaMs;
            if (elapsed >= durations[phase]) {
                elapsed -= durations[phase];
                phaseIndex = (phaseIndex + 1) % order.length;
                phase = order[phaseIndex];
            }
        },
    };
}
`,
    viewCode: `// Traffic Light - View
// Draws three circles, highlighting the active phase.
// Uses watch() to only redraw when the phase changes.

function createView(model: any): any {
    setBackground(0x0f1a0f);
    const view = new Container();

    // Draw housing
    const housing = new Graphics();
    housing.roundRect(50, 30, 100, 320, 16);
    housing.fill(0x333333);
    housing.stroke({ color: 0x555555, width: 3 });
    view.addChild(housing);

    // Light positions
    const lights: { color: number; y: number; phase: string }[] = [
        { color: 0xff0000, y: 100, phase: 'red' },
        { color: 0xffcc00, y: 200, phase: 'yellow' },
        { color: 0x00cc00, y: 300, phase: 'green' },
    ];

    const lightGraphics: any[] = [];

    for (let i = 0; i < lights.length; i++) {
        const gfx = new Graphics();
        view.addChild(gfx);
        lightGraphics.push(gfx);
    }

    const watcher = watch({ phase: () => model.phase });

    drawLights(model.phase);
    view.onRender = refresh;
    return view;

    function refresh(): void {
        const w = watcher.poll();
        if (w.phase.changed) {
            drawLights(w.phase.value as string);
        }
    }

    function drawLights(activePhase: string): void {
        for (let i = 0; i < lights.length; i++) {
            const gfx = lightGraphics[i];
            const light = lights[i];
            const active = light.phase === activePhase;
            gfx.clear();
            gfx.circle(100, light.y, 35);
            gfx.fill({
                color: light.color,
                alpha: active ? 1.0 : 0.15,
            });
            if (active) {
                // Glow effect
                gfx.circle(100, light.y, 40);
                gfx.fill({ color: light.color, alpha: 0.2 });
            }
        }
    }
}
`,
};

const keyboardSprite: Preset = {
    id: 'keyboard-sprite',
    name: 'Keyboard Sprite',
    description: 'A triangle controlled by arrow keys. Supports diagonal movement. Demonstrates user input, domain coordinates, and pixel transforms.',
    canvasWidth: 400,
    canvasHeight: 300,
    modelCode: `// Keyboard Sprite - Model
// Tracks position and facing angle, responds to arrow keys.
// Supports diagonal movement when multiple keys are held.

interface SpriteModel {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
    readonly moving: boolean;
    update(deltaMs: number): void;
}

function createModel(): SpriteModel {
    let x = 200;
    let y = 150;
    let angle = 0;
    let moving = false;
    const speed = 0.15; // pixels per ms

    // Track pressed keys
    const pressed = new Set<string>();

    window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            pressed.add(e.key);
            e.preventDefault();
        }
    });
    window.addEventListener('keyup', (e) => {
        pressed.delete(e.key);
    });

    return {
        get x() { return x; },
        get y() { return y; },
        get angle() { return angle; },
        get moving() { return moving; },

        update(deltaMs: number) {
            let dx = 0;
            let dy = 0;
            if (pressed.has('ArrowUp'))    dy -= 1;
            if (pressed.has('ArrowDown'))  dy += 1;
            if (pressed.has('ArrowLeft'))  dx -= 1;
            if (pressed.has('ArrowRight')) dx += 1;

            moving = dx !== 0 || dy !== 0;
            if (!moving) return;

            // Normalise so diagonals aren't faster
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;

            angle = Math.atan2(dy, dx);

            const dist = speed * deltaMs;
            x += dx * dist;
            y += dy * dist;

            // Clamp to canvas bounds
            x = Math.max(10, Math.min(390, x));
            y = Math.max(10, Math.min(290, y));
        },
    };
}
`,
    viewCode: `// Keyboard Sprite - View
// Draws a triangle pointing in the model's movement direction.

function createView(model: any): any {
    setBackground(0x0d1520);
    const view = new Container();
    const gfx = new Graphics();
    view.addChild(gfx);

    // Draw a hint text
    const hint = new Text({
        text: 'Use arrow keys to move (diagonals work!)',
        style: {
            fontFamily: 'monospace',
            fontSize: 12,
            fill: 0x666666,
        },
    });
    hint.position.set(200, 280);
    hint.anchor.set(0.5, 0.5);
    view.addChild(hint);

    drawTriangle();
    view.onRender = refresh;
    return view;

    function refresh(): void {
        gfx.position.set(model.x, model.y);
        gfx.rotation = model.angle;
    }

    function drawTriangle(): void {
        gfx.clear();
        // Arrow-shaped triangle
        gfx.moveTo(15, 0);
        gfx.lineTo(-10, -10);
        gfx.lineTo(-5, 0);
        gfx.lineTo(-10, 10);
        gfx.closePath();
        gfx.fill(0x44ffaa);
        gfx.stroke({ color: 0x22cc88, width: 2 });
    }
}
`,
};

const countdownTimer: Preset = {
    id: 'countdown-timer',
    name: 'Countdown Timer',
    description: 'Counts down from 10 seconds with a progress bar. Demonstrates time-based transitions and progress calculation.',
    canvasWidth: 300,
    canvasHeight: 200,
    modelCode: `// Countdown Timer - Model
// Counts down from a given duration. Fires a 'done' state when complete.

type TimerPhase = 'running' | 'done';

interface TimerModel {
    readonly remaining: number;
    readonly duration: number;
    readonly progress: number;
    readonly phase: TimerPhase;
    update(deltaMs: number): void;
}

function createModel(): TimerModel {
    const duration = 10000; // 10 seconds
    let remaining = duration;
    let phase: TimerPhase = 'running';

    return {
        get remaining() { return remaining; },
        get duration() { return duration; },
        get progress() { return 1 - remaining / duration; },
        get phase() { return phase; },

        update(deltaMs: number) {
            if (phase === 'done') return;

            remaining -= deltaMs;
            if (remaining <= 0) {
                remaining = 0;
                phase = 'done';
            }
        },
    };
}
`,
    viewCode: `// Countdown Timer - View
// Shows remaining time as text and a progress bar.

function createView(model: any): any {
    setBackground(0x141020);
    const view = new Container();
    const barWidth = 240;
    const barHeight = 24;

    // Background bar
    const barBg = new Graphics();
    barBg.roundRect(30, 100, barWidth, barHeight, 6);
    barBg.fill(0x333333);
    view.addChild(barBg);

    // Progress fill
    const barFill = new Graphics();
    view.addChild(barFill);

    // Time text
    const timeText = new Text({
        text: '10.0',
        style: {
            fontFamily: 'monospace',
            fontSize: 40,
            fill: 0xffffff,
            fontWeight: 'bold',
        },
    });
    timeText.position.set(150, 55);
    timeText.anchor.set(0.5, 0.5);
    view.addChild(timeText);

    // Status text
    const statusText = new Text({
        text: '',
        style: {
            fontFamily: 'monospace',
            fontSize: 16,
            fill: 0x44ff44,
        },
    });
    statusText.position.set(150, 155);
    statusText.anchor.set(0.5, 0.5);
    view.addChild(statusText);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        const seconds = (model.remaining / 1000).toFixed(1);
        timeText.text = seconds;

        // Color shifts from green to red as time runs out
        const progress = model.progress;
        const r = Math.floor(255 * progress);
        const g = Math.floor(255 * (1 - progress));
        const color = (r << 16) | (g << 8) | 0x22;

        timeText.style.fill = color;

        // Update progress bar
        barFill.clear();
        const fillWidth = barWidth * progress;
        if (fillWidth > 0) {
            barFill.roundRect(30, 100, fillWidth, barHeight, 6);
            barFill.fill(color);
        }

        // Status
        if (model.phase === 'done') {
            statusText.text = 'TIME UP!';
            statusText.style.fill = 0xff4444;
        } else {
            statusText.text = '';
        }
    }
}
`,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const presets: readonly Preset[] = [
    bouncingBall,
    scoreCounter,
    trafficLight,
    keyboardSprite,
    countdownTimer,
];

export function getPresetById(id: string): Preset | undefined {
    for (let i = 0; i < presets.length; i++) {
        if (presets[i].id === id) return presets[i];
    }
    return undefined;
}
