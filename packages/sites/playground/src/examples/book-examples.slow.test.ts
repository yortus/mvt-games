import { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from 'audio90/headless';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Project, StartOptions } from '../project-api';
import { EXAMPLES } from './examples';

// The book's examples, in book/, which pages of the docs run in place. The
// playground doesn't list them, but the embed page finds them by their
// folder's name, as it finds the playground's own.

// Each example's main.ts, as a module, and its info, by their paths
const MAINS = import.meta.glob<{ project: Project }>('../../book/*/main.ts');
const INFOS = import.meta.glob<{ example: { name: string; description: string; stillMs?: number } }>('../../book/*/example.ts', { eager: true });

const FRAME_MS = 1000 / 60;

describe("the book's examples", () => {
    // Node has no window. Views that listen for keys there get one that takes listeners.
    beforeAll(() => {
        if (typeof window === 'undefined') vi.stubGlobal('window', new EventTarget());
    });

    it('each have a name, a description and a main.ts, and a name no playground example has', () => {
        const ids = new Set(EXAMPLES.map((example) => example.id));
        for (const [infoPath, { example }] of Object.entries(INFOS)) {
            const folder = infoPath.slice(0, infoPath.lastIndexOf('/'));
            expect(example.name).not.toBe('');
            expect(example.description).not.toBe('');
            expect(MAINS).toHaveProperty([`${folder}/main.ts`]);
            expect(ids).not.toContain(folder.slice(folder.lastIndexOf('/') + 1));
        }
    });

    for (const infoPath of Object.keys(INFOS)) {
        const folder = infoPath.slice(0, infoPath.lastIndexOf('/'));
        it(`${folder.slice(folder.lastIndexOf('/') + 1)} runs for a second, headless, with no error`, async () => {
            const { project } = await MAINS[`${folder}/main.ts`]();
            expect(project.renderer).toBe('pixi');
            if (project.renderer !== 'pixi') return;
            const stage = new Container();
            const options: StartOptions & { stage: Container } = { stage, sound: createHeadlessAudio80(), width: project.width, height: project.height };
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
