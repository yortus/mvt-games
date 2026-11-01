import { Container } from 'pixi.js';
import { advanceTime } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import type { Project } from '../../project-api';
import { EXAMPLES } from '../examples';

// A still of each example, a moment after it starts. The docs show it in
// place of the running example until the reader presses Run, and in print,
// where nothing runs. So the reference image of each test here is also the
// example's picture in the book.

// Each example's main.ts, as a module, by its folder
const MAINS = import.meta.glob<{ project: Project }>('../../../examples/*/main.ts', { eager: true });

/** How long each example runs before its still is taken, if not the usual time: long enough to show what it does. */
const STILL_MS: Readonly<Record<string, number>> = {
    // Falling, in mid-air, rather than on the floor
    'bouncing-ball': 350,
    'bouncing-ball-jsx': 350,
};

/** How long an example runs before its still is taken, unless `STILL_MS` says otherwise. */
const USUAL_STILL_MS = 1500;

for (const example of EXAMPLES) {
    const { project } = MAINS[`../../../examples/${example.id}/main.ts`];
    if (project.renderer !== 'pixi') continue;
    const options = {
        kind: 'pixi',
        width: project.width,
        height: project.height,
        background: project.background,
        pixelArt: project.pixelArt ?? false,
    } as const;
    canvasTest(example.id, options, async () => {
        const stage = new Container();
        const ticked = await project.start({ stage, sound: createHeadlessAudio80(), width: project.width, height: project.height });
        const stillMs = STILL_MS[example.id] ?? USUAL_STILL_MS;
        await (ticked === undefined ? advanceTime(stillMs, stage) : advanceTime(stillMs, ticked, stage));
        return stage;
    });
}
