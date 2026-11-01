import { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from 'audio90/headless';
import { canvasTest } from 'v-snap';
import { it } from 'vitest';
import type { Project } from '../../project-api';

// A still of each of the book's examples, in book/, as examples.test.ts
// takes one of each of the playground's. The book shows it in place of the
// running example until the reader presses Run, and in print. An example
// says when its still is taken, in its example.ts, as `stillMs`: the moment
// that best shows what its page is about. The example runs as the
// playground runs it, a frame at a time, refreshing every frame, so a still
// is a frame the reader would see: a view that a <List> builds in a refresh
// has had its update steps by then.
//
// A test's options need the project's size, which only its module knows, so
// each example loads as the tests are collected. One that fails to load fails
// its own test, and the others still run.

// Each example's main.ts, as a module, and its info, by their paths
const MAINS = import.meta.glob<{ project: Project }>('../../../book/*/main.ts');
const INFOS = import.meta.glob<{ example: { stillMs?: number } }>('../../../book/*/example.ts', { eager: true });

/** How long an example runs before its still is taken, unless it says otherwise. */
const USUAL_STILL_MS = 1500;

/** One frame at 60 frames a second, rounded down, as advanceTime steps. */
const FRAME_MS = 16;

for (const [infoPath, info] of Object.entries(INFOS)) {
    const folder = infoPath.slice(0, infoPath.lastIndexOf('/'));
    const id = folder.slice(folder.lastIndexOf('/') + 1);
    const stillMs = info.example.stillMs ?? USUAL_STILL_MS;
    let project: Project;
    try {
        ({ project } = await MAINS[`${folder}/main.ts`]());
    }
    catch (error) {
        it(id, () => {
            throw error;
        });
        continue;
    }
    if (project.renderer !== 'pixi') continue;
    const options = {
        kind: 'pixi',
        width: project.width,
        height: project.height,
        background: project.background,
        pixelArt: project.pixelArt ?? false,
    } as const;
    canvasTest(id, options, async () => {
        const stage = new Container();
        const ticked = await project.start({ stage, sound: createHeadlessAudio80(), width: project.width, height: project.height });
        for (let remaining = stillMs; remaining > 0; remaining -= FRAME_MS) {
            const step = Math.min(FRAME_MS, remaining);
            ticked?.update(step);
            updateView(stage, step);
            refreshView(stage);
            // A model with an internal await moves on, as it would between frames
            await Promise.resolve();
        }
        return stage;
    });
}
