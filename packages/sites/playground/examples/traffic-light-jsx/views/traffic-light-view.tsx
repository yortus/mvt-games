/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import type { TrafficLightModel } from '../models';
import { LightView } from './light-view';

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
 * The housing and its three lights. Each light is a `LightView`, a view
 * named in PascalCase, so it can be used as a JSX tag. Its `isLit` binding
 * follows the model's phase.
 */
export function TrafficLightView({ model }: TrafficLightViewBindings): Container {
    return (
        <container>
            <graphics ref={drawHousing} />
            <LightView color={0xff0000} x={100} y={100} isLit={() => model.phase === 'red'} />
            <LightView color={0xffcc00} x={100} y={200} isLit={() => model.phase === 'yellow'} />
            <LightView color={0x00cc00} x={100} y={300} isLit={() => model.phase === 'green'} />
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function drawHousing(g: Graphics): void {
    g.roundRect(50, 30, 100, 320, 16).fill(0x333333).stroke({ color: 0x555555, width: 3 });
}
