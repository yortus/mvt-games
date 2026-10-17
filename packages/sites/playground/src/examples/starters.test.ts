// @vitest-environment happy-dom
import { Container } from 'pixi.js';
import { PerspectiveCamera, Scene } from 'three';
import { refreshView, updateView } from '@mvtjs/pixi';
import { createHeadlessAudio80 } from '@mvtjs/chiptune/headless';
import { describe, expect, it } from 'vitest';
import type { Project, StartResult } from '../project-api';
import { STARTERS } from './examples';

// Each starting project's main.ts, as a module, by its folder
const MAINS = import.meta.glob<{ project: Project }>('../../starters/*/main.ts');

const FRAME_MS = 1000 / 60;

describe('the starting projects', () => {
    it('are one for each renderer, each with a name, a description and a main.ts', () => {
        expect(STARTERS.map((s) => s.renderer)).toEqual(['pixi', 'html', 'three']);
        for (const starter of STARTERS) {
            expect(starter.name).not.toBe('');
            expect(starter.description).not.toBe('');
            expect(starter.files.map((f) => f.path)).toContain('main.ts');
        }
    });

    for (const starter of STARTERS) {
        it(`${starter.renderer} runs for a second, headless, with no error, and draws something`, async () => {
            const { project } = await MAINS[`../../starters/${starter.renderer}/main.ts`]();
            expect(project.renderer).toBe(starter.renderer);
            const { audio80: sound } = createHeadlessAudio80();
            // The root the views go in, and what start returns, for each renderer
            let root: Container | Scene | HTMLElement;
            let ticked: StartResult;
            if (project.renderer === 'pixi') {
                root = new Container();
                ticked = await project.start({ stage: root, sound, width: project.width, height: project.height });
            }
            else if (project.renderer === 'three') {
                root = new Scene();
                const camera = new PerspectiveCamera();
                ticked = await project.start({ scene: root, camera, sound, width: project.width, height: project.height });
            }
            else {
                root = document.createElement('div');
                ticked = await project.start({ root, sound, width: 400, height: 300 });
            }
            for (let elapsed = 0; elapsed < 1000; elapsed += FRAME_MS) {
                ticked?.update(FRAME_MS);
                updateView(root, FRAME_MS);
                refreshView(root);
            }
            expect(root.children.length).toBeGreaterThan(0);
        });
    }
});
