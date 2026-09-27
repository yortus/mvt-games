import {
    createGrainGrid, type GrainGridSnapshot, type GrainKind, type Grains, type GrainStorageKind,
} from './grain-grid';
import {
    BRUSH_RADIUS, FLIP_DURATION_MS, MAX_STEPS_PER_UPDATE, POUR_FALL_SPEED, SPRAY_GRAINS_PER_STEP, STEP_MS,
} from './model-constants';
import { createRandom } from './random';
import { addStartingScene } from './starting-scene';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the pointer does in the tank: pour a kind of grain, or erase. */
export type ToolKind = GrainKind | 'erase';

/** `'flipping'` while the tank turns upside down; the grains are still until it lands. */
export type TankPhase = 'running' | 'flipping';

/** What the tank holds at the start and after a reset. */
export type SceneKind = 'starting' | 'empty';

/**
 * The demo's whole model: an aquarium, the tank, of falling sand, water and
 * walls. The top-level model, which the entry creates and the top-level
 * view reads.
 *
 * The grains advance on a fixed timestep (60 steps per second, whatever the
 * frame rate), so a run depends only on the sequence of `update()` calls and
 * the inputs between them. Pouring is part of that: while the pointer is held
 * down, each step pours or stamps at the pour point, so the amount poured
 * does not depend on the frame rate either.
 *
 * Everything is in cells. The view converts pointer positions to cells before
 * calling `startPour`/`movePour`, and cells to pixels when drawing.
 *
 * The same interface whichever way the tank stores its grains (`storage`,
 * fixed when the tank is created), and the same behaviour, step for step.
 * Nothing that reads the tank can tell the two apart, except by timing them.
 * `save()` captures the whole tank as plain data, which is how the tests
 * check that two tanks driven the same way stay identical, and `load()`
 * resumes from it, in a tank of either storage kind.
 */
export interface DemoModel {
    readonly cols: number;
    readonly rows: number;
    /** How the tank stores its grains. Fixed for the tank's life. */
    readonly storage: GrainStorageKind;

    /** Every grain, addressed by id. See `Grains`. */
    readonly grains: Grains;
    readonly grainCount: number;
    /** Grains the simulation is still moving; the rest are asleep. */
    readonly movingCount: number;

    readonly phase: TankPhase;
    /**
     * How far through the current flip the tank is, from 0 to 1, rising
     * steadily over the flip's half second. 0 while running.
     */
    readonly flipProgress: number;

    /** The selected tool. */
    tool: ToolKind;
    /** Radius, in cells, of the area the selected tool affects around the pour point. */
    readonly brushRadius: number;

    readonly isPouring: boolean;
    /** Where the pour is aimed, in cells. Fractional. Meaningful while pouring. */
    readonly pourCol: number;
    readonly pourRow: number;

    /** Start pouring with the selected tool at a point, in cells. */
    startPour: (col: number, row: number) => void;
    /** Move the pour point while pouring. Ignored when not pouring. */
    movePour: (col: number, row: number) => void;
    endPour: () => void;

    /** Turn the tank upside down over half a second. Ignored while already flipping. */
    flip: () => void;
    /** Restore the scene the model started with. */
    reset: () => void;
    /** Empty the tank of every grain, walls included. */
    clear: () => void;

    /** A copy of the tank's whole state, grains, pour, flip and random numbers included. */
    save: () => DemoSnapshot;
    /** Resume from a snapshot of a tank the same size, of either storage kind. Throws if the sizes differ. */
    load: (snapshot: DemoSnapshot) => void;

    update: (deltaMs: number) => void;
}

/** Everything a tank holds, in plain data. See `DemoModel.save`. */
export interface DemoSnapshot {
    readonly grid: GrainGridSnapshot;
    readonly randomState: number;
    readonly phase: TankPhase;
    readonly flipElapsedMs: number;
    readonly stepAccumulatorMs: number;
    readonly tool: ToolKind;
    readonly isPouring: boolean;
    readonly pourCol: number;
    readonly pourRow: number;
    readonly stampedCol: number;
    readonly stampedRow: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DemoModelOptions {
    readonly cols: number;
    readonly rows: number;
    /** Defaults to `'objects'`. */
    readonly storage?: GrainStorageKind;
    /** Seed for the random choices grains make. Defaults to 1. */
    readonly seed?: number;
    /** Defaults to `'starting'`: a dune, two ledges, and sand and water pouring off them. */
    readonly scene?: SceneKind;
    /**
     * Scales every brush's radius, and the number of grains sprayed per step
     * with the brush's area, so a tank of many small cells fills about as
     * fast, for its size, as one of few large cells. Defaults to 1.
     */
    readonly brushScale?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDemoModel(options: DemoModelOptions): DemoModel {
    const { cols, rows, storage = 'objects', scene = 'starting', brushScale = 1 } = options;
    const random = createRandom(options.seed ?? 1);
    const grid = createGrainGrid(storage, { cols, rows, random: random.next });
    const sprayCount = Math.round(SPRAY_GRAINS_PER_STEP * brushScale * brushScale);

    let phase: TankPhase = 'running';
    let flipElapsedMs = 0;
    let stepAccumulatorMs = 0;
    // The current update's elapsed time, for `advance`, which takes no arguments.
    let pendingDeltaMs = 0;

    let tool: ToolKind = 'sand';
    let isPouring = false;
    let pourCol = 0;
    let pourRow = 0;
    // Where the last wall or erase stamp was made, so the next one can join it up.
    let stampedCol = 0;
    let stampedRow = 0;

    const model: DemoModel = {
        cols,
        rows,
        storage,
        grains: grid.grains,
        get grainCount() { return grid.grainCount; },
        get movingCount() { return grid.movingCount; },
        get phase() { return phase; },
        get flipProgress() {
            return phase === 'flipping' ? Math.min(flipElapsedMs / FLIP_DURATION_MS, 1) : 0;
        },
        get tool() { return tool; },
        set tool(value) { tool = value; },
        get brushRadius() { return BRUSH_RADIUS[tool] * brushScale; },
        get isPouring() { return isPouring; },
        get pourCol() { return pourCol; },
        get pourRow() { return pourRow; },

        startPour(col, row) {
            isPouring = true;
            pourCol = col;
            pourRow = row;
            stampedCol = col;
            stampedRow = row;
        },
        movePour(col, row) {
            if (!isPouring) return;
            pourCol = col;
            pourRow = row;
        },
        endPour() {
            isPouring = false;
        },

        flip() {
            if (phase === 'flipping') return;
            phase = 'flipping';
            flipElapsedMs = 0;
        },
        reset,
        clear() {
            grid.clear();
            standUpright();
        },
        save,
        load,
        update,
    };

    reset();
    return model;

    // --- Update -------------------------------------------------------------

    function update(deltaMs: number): void {
        // However many steps this takes, one change for anything tracking the
        // grains, so it never sees the tank half stepped. `advance` is a
        // named function, not a closure, so no frame allocates one.
        pendingDeltaMs = deltaMs;
        grid.batch(advance);
    }

    function advance(): void {
        const deltaMs = pendingDeltaMs;
        if (phase === 'flipping') {
            advanceFlip(deltaMs);
            return;
        }

        stepAccumulatorMs += deltaMs;
        let steps = 0;
        while (stepAccumulatorMs >= STEP_MS && steps < MAX_STEPS_PER_UPDATE) {
            if (isPouring) applyPour();
            grid.step();
            stepAccumulatorMs -= STEP_MS;
            steps++;
        }
        // After a stall, drop the backlog rather than spend the next frames catching up.
        if (steps === MAX_STEPS_PER_UPDATE) stepAccumulatorMs = 0;
    }

    function advanceFlip(deltaMs: number): void {
        flipElapsedMs += deltaMs;
        if (flipElapsedMs < FLIP_DURATION_MS) return;

        // Landed upside down. Turning the grains a half turn while the tank
        // stands upright again leaves every grain exactly where it appeared to be.
        grid.rotateHalfTurn();
        phase = 'running';
        stepAccumulatorMs = 0;
    }

    function reset(): void {
        grid.batch(rebuildScene);
        standUpright();
    }

    function rebuildScene(): void {
        grid.clear();
        if (scene === 'starting') addStartingScene(grid);
    }

    /** Stand the tank upright and idle, after its contents are replaced. */
    function standUpright(): void {
        phase = 'running';
        flipElapsedMs = 0;
        stepAccumulatorMs = 0;
    }

    // --- Saving and loading -------------------------------------------------

    function save(): DemoSnapshot {
        return {
            grid: grid.save(),
            randomState: random.state,
            phase,
            flipElapsedMs,
            stepAccumulatorMs,
            tool,
            isPouring,
            pourCol,
            pourRow,
            stampedCol,
            stampedRow,
        };
    }

    function load(snapshot: DemoSnapshot): void {
        grid.load(snapshot.grid);
        random.state = snapshot.randomState;
        phase = snapshot.phase;
        flipElapsedMs = snapshot.flipElapsedMs;
        stepAccumulatorMs = snapshot.stepAccumulatorMs;
        tool = snapshot.tool;
        isPouring = snapshot.isPouring;
        pourCol = snapshot.pourCol;
        pourRow = snapshot.pourRow;
        stampedCol = snapshot.stampedCol;
        stampedRow = snapshot.stampedRow;
    }

    // --- Pouring ------------------------------------------------------------

    function applyPour(): void {
        if (tool === 'sand' || tool === 'water') {
            spray(tool);
        }
        else {
            stampAlongPath();
        }
    }

    /**
     * Drop grains at random cells within the brush, like a stream from a
     * spout: already falling, so they clear the brush for the next ones.
     */
    function spray(kind: GrainKind): void {
        const radius = BRUSH_RADIUS[kind] * brushScale;
        for (let i = 0; i < sprayCount; i++) {
            const dx = (random.next() * 2 - 1) * radius;
            const dy = (random.next() * 2 - 1) * radius;
            if (dx * dx + dy * dy > radius * radius) continue;
            grid.add(Math.floor(pourCol + dx), Math.floor(pourRow + dy), kind, POUR_FALL_SPEED);
        }
    }

    /** Stamp discs from the last stamp to the pour point, one cell apart, so a fast drag leaves no gaps. */
    function stampAlongPath(): void {
        const dx = pourCol - stampedCol;
        const dy = pourRow - stampedRow;
        const stampCount = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy)));
        for (let i = 1; i <= stampCount; i++) {
            const t = i / stampCount;
            stampDisc(Math.floor(stampedCol + dx * t), Math.floor(stampedRow + dy * t));
        }
        stampedCol = pourCol;
        stampedRow = pourRow;
    }

    function stampDisc(col: number, row: number): void {
        const radius = BRUSH_RADIUS[tool] * brushScale;
        const reach = Math.floor(radius);
        for (let dy = -reach; dy <= reach; dy++) {
            for (let dx = -reach; dx <= reach; dx++) {
                if (dx * dx + dy * dy > radius * radius) continue;
                if (tool === 'erase') grid.remove(col + dx, row + dy);
                else if (tool === 'wall') grid.add(col + dx, row + dy, 'wall');
            }
        }
    }
}
