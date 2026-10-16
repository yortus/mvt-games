import { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from '@mvtjs/audio/headless';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Project, StartOptions } from '../project-api';
import { EXAMPLES } from './examples';

// Each example's main.ts, as a module, by its folder
const MAINS = import.meta.glob<{ project: Project }>('../../examples/*/main.ts');

const FRAME_MS = 1000 / 60;

describe('the examples', () => {
    // Node has no window. Views that listen for keys there get one that takes listeners.
    beforeAll(() => {
        if (typeof window === 'undefined') vi.stubGlobal('window', new EventTarget());
    });

    it('are all listed, each with a name, a description and a main.ts', () => {
        expect(EXAMPLES.length).toBe(Object.keys(MAINS).length);
        for (const example of EXAMPLES) {
            expect(example.name).not.toBe('');
            expect(example.description).not.toBe('');
            expect(example.files.map((f) => f.path)).toContain('main.ts');
        }
    });

    for (const example of EXAMPLES) {
        it(`${example.id} runs for a second, headless, with no error`, async () => {
            const { project } = await MAINS[`../../examples/${example.id}/main.ts`]();
            expect(project.renderer).toBe('pixi');
            if (project.renderer !== 'pixi') return;
            const stage = new Container();
            const { audio80 } = createHeadlessAudio80();
            const options: StartOptions & { stage: Container } = { stage, sound: audio80, width: project.width, height: project.height };
            const ticked = await project.start(options);
            for (let elapsed = 0; elapsed < 1000; elapsed += FRAME_MS) {
                ticked?.update(FRAME_MS);
                updateView(stage, FRAME_MS);
                refreshView(stage);
            }
            expect(stage.children.length).toBeGreaterThan(0);
        });
    }
});
