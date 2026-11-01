/** @jsxImportSource @mvtjs/pixi */

import type { Container, Graphics } from 'pixi.js';
import { List, Match, Switch } from '@mvtjs/pixi';
import type { EnemyKind, SkyModel } from '../models';
import { AsteroidShape } from './asteroid-shape';
import { saucerTexture } from './textures';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface SkyViewBindings {
    readonly model: SkyModel;
    /** The size of the sky, in world units, which are this view's pixels. */
    readonly width: number;
    readonly height: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The enemies, and below them, the list's slots. A slot's view is built
 * once, so it can't turn into another kind of view. Instead, each slot
 * holds a `<Switch>`, with a branch for each kind, and shows the branch
 * for the kind of enemy in the slot now.
 *
 * When an enemy leaves, the last enemy moves into its slot, and that slot's
 * square below changes colour if the kind changed.
 */
export function SkyView({ model, width, height }: SkyViewBindings): Container {
    return (
        <container>
            <List items={model.enemies}>
                {(enemy) => (
                    <Switch>
                        <Match when={() => enemy().kind === 'asteroid'}>
                            <AsteroidShape
                                x={() => enemy().x}
                                y={() => enemy().y}
                                seed={() => enemy().seed}
                            />
                        </Match>
                        <Match when={() => enemy().kind === 'saucer'}>
                            <sprite
                                texture={saucerTexture}
                                x={() => enemy().x}
                                y={() => enemy().y}
                            />
                        </Match>
                    </Switch>
                )}
            </List>

            <container y={height}>
                <graphics ref={(g) => drawPanel(g, width)} />
                <text text="The list's slots, by the kind of enemy in each now:" x={16} y={8} style={LABEL_STYLE} />
                <container x={16} y={34}>
                    <List items={model.enemies}>
                        {(enemy, index) => (
                            <graphics
                                x={index * MARKER_SPACING}
                                tint={() => MARKER_COLORS[enemy().kind]}
                                ref={drawMarker}
                            />
                        )}
                    </List>
                </container>
            </container>
        </container>
    );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How tall the panel below the sky is, in pixels. */
const PANEL_HEIGHT = 70;
/** How far apart the slots' squares are, in pixels. */
const MARKER_SPACING = 26;
const MARKER_COLORS: Readonly<Record<EnemyKind, number>> = { asteroid: 0xb09a7a, saucer: 0x9fe8ff };
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: 14, fill: 0xe8ecff };

function drawPanel(g: Graphics, width: number): void {
    g.rect(0, 0, width, PANEL_HEIGHT).fill(0x141b33);
    g.moveTo(0, 0).lineTo(width, 0).stroke({ color: 0x2a3866, width: 2 });
}

/** Drawn in white, so its tint gives its colour. */
function drawMarker(g: Graphics): void {
    g.rect(0, 0, 22, 22).fill(0xffffff);
}
