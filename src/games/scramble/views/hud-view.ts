import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { watch } from '#common';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HudViewBindings {
    getScore(): number;
    getLives(): number;
    getFuel(): number;
    getSectionIndex(): number;
    getLoop(): number;
    getScreenWidth(): number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FUEL_BAR_WIDTH = 80;
const FUEL_BAR_HEIGHT = 10;
const FUEL_BAR_X_OFFSET = 8;
const HUD_TEXT_Y = 5;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHudView(bindings: HudViewBindings): Container {
    const watcher = watch({
        score: bindings.getScore,
        lives: bindings.getLives,
        fuel: bindings.getFuel,
        section: bindings.getSectionIndex,
        loop: bindings.getLoop,
    });

    let scoreText: Text;
    let sectionText: Text;
    let livesContainer: Container;
    let fuelBarBg: Graphics;
    let fuelBarFill: Graphics;
    let fuelLabel: Text;

    const view = new Container();
    initialiseView();
    view.onRender = refresh;
    return view;

    function initialiseView(): void {
        const screenWidth = bindings.getScreenWidth();

        // Score - left
        scoreText = new Text({
            text: '0',
            style: { fontFamily: 'monospace', fontSize: 12, fill: 0xffffff },
        });
        scoreText.position.set(8, HUD_TEXT_Y);
        view.addChild(scoreText);

        // Lives - centre (ship icons)
        livesContainer = new Container();
        livesContainer.position.set(screenWidth / 2 - 30, HUD_TEXT_Y);
        view.addChild(livesContainer);
        updateLives(3);

        // Fuel bar - right
        fuelLabel = new Text({
            text: 'FUEL',
            style: { fontFamily: 'monospace', fontSize: 10, fill: 0xaaaaaa },
        });
        fuelLabel.position.set(screenWidth - FUEL_BAR_WIDTH - FUEL_BAR_X_OFFSET - 36, HUD_TEXT_Y + 1);
        view.addChild(fuelLabel);

        fuelBarBg = new Graphics();
        fuelBarBg.rect(0, 0, FUEL_BAR_WIDTH, FUEL_BAR_HEIGHT).fill(0x333333);
        fuelBarBg.position.set(screenWidth - FUEL_BAR_WIDTH - FUEL_BAR_X_OFFSET, HUD_TEXT_Y + 2);
        view.addChild(fuelBarBg);

        fuelBarFill = new Graphics();
        fuelBarFill.position.set(screenWidth - FUEL_BAR_WIDTH - FUEL_BAR_X_OFFSET, HUD_TEXT_Y + 2);
        view.addChild(fuelBarFill);
        drawFuelBar(1.0);

        // Section indicator - below score
        sectionText = new Text({
            text: 'S1',
            style: { fontFamily: 'monospace', fontSize: 10, fill: 0xaaaaaa },
        });
        sectionText.position.set(80, HUD_TEXT_Y + 2);
        view.addChild(sectionText);
    }

    function refresh(): void {
        const watched = watcher.poll();

        if (watched.score.changed) {
            scoreText.text = String(watched.score.value);
        }
        if (watched.lives.changed) {
            updateLives(watched.lives.value as number);
        }
        if (watched.fuel.changed) {
            drawFuelBar(watched.fuel.value as number);
        }
        if (watched.section.changed || watched.loop.changed) {
            const section = (bindings.getSectionIndex() + 1);
            const loop = bindings.getLoop();
            sectionText.text = loop > 0 ? `S${section} L${loop + 1}` : `S${section}`;
        }
    }

    function updateLives(lives: number): void {
        livesContainer.removeChildren();
        const tex = textures.get().ship.icon;
        for (let i = 0; i < lives; i++) {
            const icon = new Sprite({ texture: tex, anchor: { x: 0, y: 0 } });
            icon.position.set(i * 12, 0);
            icon.scale.set(1);
            livesContainer.addChild(icon);
        }
    }

    function drawFuelBar(fuel: number): void {
        fuelBarFill.clear();
        if (fuel <= 0) return;

        const fillWidth = FUEL_BAR_WIDTH * fuel;
        let color: number;
        if (fuel > 0.5) color = 0x00cc00;
        else if (fuel > 0.25) color = 0xcccc00;
        else color = 0xcc0000;

        fuelBarFill.rect(0, 0, fillWidth, FUEL_BAR_HEIGHT).fill(color);
    }
}
