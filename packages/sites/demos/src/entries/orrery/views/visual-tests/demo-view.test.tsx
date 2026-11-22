import { expect, it } from 'vitest';
import { canvasTest } from 'v-snap';
import { createHeadlessAudio80 } from 'audio90/headless';
import { advanceTime } from '@mvtjs/pixi';
import { destroyAndFindLeaks } from '@mvtjs/pixi-3d';
import { createDemoModel } from '../../models';
import { DemoView, SCREEN_HEIGHT, SCREEN_WIDTH } from '../demo-view';

const SIZE = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, pixelArt: false };

// The worlds spread round their orbits, lit on the sun's side, and the day count above them
canvasTest('some days in', SIZE, async () => {
    const model = createDemoModel();
    const view = DemoView({ model, sfx: createHeadlessAudio80() });
    await advanceTime(3000, model, view);
    return view;
});

// Leaving the orrery destroys its view, and the view must free every geometry, material and texture that its 3D views made
it('frees every resource that its 3D views made when it is destroyed', async () => {
    const model = createDemoModel();
    const view = DemoView({ model, sfx: createHeadlessAudio80() });
    await advanceTime(0, model, view);

    expect(destroyAndFindLeaks(view)).toEqual([]);
});
