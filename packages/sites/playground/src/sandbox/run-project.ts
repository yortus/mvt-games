import type { Project, StartOptions, StartResult } from '../project-api';
import type { RendererHost } from './renderer-host';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** A sound chip, and the controls that pause it and let it play on. */
export interface ProjectSound {
    readonly audio80: object;
    readonly controls: {
        readonly pause: () => void;
        readonly resume: () => void;
    };
}

/** A project's sound chip, made the first time `chip` is called. */
export interface LazySound {
    readonly chip: () => object;
    /** The chip's controls, once it is made. */
    readonly controls: () => ProjectSound['controls'] | undefined;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface RunProjectOptions<P extends Project> {
    readonly project: P;
    /** Makes the renderer the project draws with. */
    readonly createHost: (project: P) => RendererHost<object> | Promise<RendererHost<object>>;
    /** Makes the project's sound chip, the first time the project reads `sound`. */
    readonly createSound: () => ProjectSound;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Runs a project on a page of its own, as an exported project does: makes
 * its renderer, calls `start`, and runs the MVT loop each frame. The
 * project's `update`, then `updateView` over its root, then `refreshView`,
 * then a draw.
 */
export async function runProject<P extends Project>(options: RunProjectOptions<P>): Promise<void> {
    const { project } = options;
    const sound = createLazySound(options.createSound);
    const host = await options.createHost(project);
    const startOptions = Object.defineProperty({ ...host.startOptions }, 'sound', { get: sound.chip, enumerable: true });
    const ticked = await (project.start as (o: StartOptions) => StartResult | Promise<StartResult>)(startOptions as StartOptions);
    let lastTime: number | undefined;
    requestAnimationFrame(frame);

    function frame(time: number): void {
        const deltaMs = lastTime === undefined ? 0 : Math.min(time - lastTime, MAX_FRAME_MS);
        lastTime = time;
        ticked?.update(deltaMs);
        host.update(deltaMs);
        host.refresh();
        host.render();
        requestAnimationFrame(frame);
    }
}

/**
 * The project's sound chip, made the first time it is read, so a project
 * that never reads `sound` makes no sound.
 */
export function createLazySound(create: () => ProjectSound): LazySound {
    let made: ProjectSound | undefined;
    return {
        chip() {
            made ??= create();
            return made.audio80;
        },
        controls: () => made?.controls,
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The longest frame the loop advances by, so a tab left in the background does not jump ahead. */
const MAX_FRAME_MS = 100;
