import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';
import { createReaction } from '@mvtjs/utils';
import type { LightPhase, TrafficLightModel } from '../models';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface TrafficLightViewBindings {
    readonly model: TrafficLightModel;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The housing and its three lights, with the light for the model's phase
 * lit. The lights are drawn as the view is made, and again only when the
 * phase changes, which a reaction notices.
 */
export function TrafficLightView({ model }: TrafficLightViewBindings): Container {
    const view = new Container();

    const housing = new Graphics();
    housing.roundRect(50, 30, 100, 320, 16).fill(0x333333).stroke({ color: 0x555555, width: 3 });
    view.addChild(housing);

    const lightGraphics: Graphics[] = [];
    for (let i = 0; i < LIGHTS.length; i++) {
        const g = new Graphics();
        view.addChild(g);
        lightGraphics.push(g);
    }

    const drawLightsWhenPhaseChanges = createReaction({ watch: () => model.phase, react: drawLights });

    drawLights(model.phase);
    setRefresh(view, drawLightsWhenPhaseChanges);
    return view;

    function drawLights(litPhase: LightPhase): void {
        for (let i = 0; i < LIGHTS.length; i++) {
            const { phase, color, y } = LIGHTS[i];
            const isLit = phase === litPhase;
            const g = lightGraphics[i];
            g.clear();
            g.circle(100, y, 35).fill({ color, alpha: isLit ? 1 : 0.15 });
            // A glow around the lit light
            if (isLit) g.circle(100, y, 40).fill({ color, alpha: 0.2 });
        }
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Each light: the phase it shows, its colour, and where its middle is. */
const LIGHTS: readonly { readonly phase: LightPhase; readonly color: number; readonly y: number }[] = [
    { phase: 'red', color: 0xff0000, y: 100 },
    { phase: 'yellow', color: 0xffcc00, y: 200 },
    { phase: 'green', color: 0x00cc00, y: 300 },
];
