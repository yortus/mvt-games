/** @jsxImportSource @mvtjs/pixi */

import { type Container, Texture } from 'pixi.js';
import { memoiseLast } from '@mvtjs/utils';
import { List } from '@mvtjs/pixi';
import { PixelTextView } from '#shared';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    score: () => number;
    lives: () => number;
    /** Fuel left, from 0 to 1. */
    fuel: () => number;
    sectionIndex: () => number;
    loop: () => number;
    /** Lays out the HUD, so read once. */
    screenWidth: number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/** The bar below the play area: score and section on the left, lives in the middle, fuel on the right. */
export function HudView(bindings: HudViewBindings): Container {
    const { screenWidth } = bindings;
    const fuelBarX = screenWidth - FUEL_BAR_WIDTH - FUEL_BAR_X_OFFSET;
    const lifeIcon = textures.get().ship.icon;

    // Rebuilt only when the score changes.
    const scoreText = memoiseLast((score: number) => String(score));
    // The section text last shown, rebuilt only when the section or loop changes.
    let shownSection = NaN;
    let shownLoop = NaN;
    let sectionText = '';

    return (
        <container>
            <container x={8} y={GLYPHS_Y}>
                <PixelTextView text={() => scoreText(bindings.score())} color={SCORE_COLOR} />
            </container>
            <container x={80} y={GLYPHS_Y}>
                <PixelTextView text={getSectionText} color={LABEL_COLOR} />
            </container>

            <container x={screenWidth / 2 - 30} y={HUD_TEXT_Y}>
                <List items={{ length: bindings.lives, at: (i) => i }}>
                    {(_, i) => <sprite texture={lifeIcon} x={i * 12} />}
                </List>
            </container>

            <container x={fuelBarX - 6} y={GLYPHS_Y}>
                <PixelTextView text="FUEL" color={LABEL_COLOR} anchorX={1} />
            </container>
            <container x={fuelBarX} y={HUD_TEXT_Y + 2}>
                <graphics ref={(g) => g.rect(0, 0, FUEL_BAR_WIDTH, FUEL_BAR_HEIGHT).fill(0x333333)} />
                <sprite
                    texture={Texture.WHITE}
                    height={FUEL_BAR_HEIGHT}
                    visible={() => bindings.fuel() > 0}
                    width={() => FUEL_BAR_WIDTH * bindings.fuel()}
                    tint={() => pickFuelColor(bindings.fuel())}
                />
            </container>
        </container>
    );

    function getSectionText(): string {
        const section = bindings.sectionIndex();
        const loop = bindings.loop();
        if (section !== shownSection || loop !== shownLoop) {
            shownSection = section;
            shownLoop = loop;
            sectionText = loop > 0 ? `S${section + 1} L${loop + 1}` : `S${section + 1}`;
        }
        return sectionText;
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const FUEL_BAR_WIDTH = 80;
const FUEL_BAR_HEIGHT = 10;
const FUEL_BAR_X_OFFSET = 8;
const HUD_TEXT_Y = 5;
/** The text, in the pixel glyphs at their own size, level with the middle of the fuel bar. */
const GLYPHS_Y = HUD_TEXT_Y + 3;

const SCORE_COLOR = 0xffffff;
const LABEL_COLOR = 0xaaaaaa;

/** Green above half, yellow above a quarter, red below. */
function pickFuelColor(fuel: number): number {
    if (fuel > 0.5) return 0x00cc00;
    if (fuel > 0.25) return 0xcccc00;
    return 0xcc0000;
}
