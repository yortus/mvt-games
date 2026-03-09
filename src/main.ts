import { Application } from 'pixi.js';
import { createCabinetModel, createCabinetView, type CabinetViewBindings } from './cabinet';
import { createAsteroidsEntry, createDigdugEntry, createGalagaEntry, createPacmanEntry } from './games';

// ---------------------------------------------------------------------------
// Default cabinet dimensions (used for the menu screen)
// ---------------------------------------------------------------------------

const CABINET_WIDTH = 480;
const CABINET_HEIGHT = 360;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    const app = new Application();
    await app.init({
        width: CABINET_WIDTH,
        height: CABINET_HEIGHT,
        backgroundColor: 0x000000,
        antialias: true,
    });
    document.body.appendChild(app.canvas);

    // ---- Game registry -----------------------------------------------------
    const games = [createAsteroidsEntry(), createDigdugEntry(), createGalagaEntry(), createPacmanEntry()];

    // ---- Cabinet model -----------------------------------------------------
    const cabinet = createCabinetModel({ games });

    // ---- Bindings (Cabinet Model → Cabinet View) ---------------------------
    const bindings: CabinetViewBindings = {
        getPhase: () => cabinet.phase,
        getGameCount: () => cabinet.games.length,
        getGameName: (i) => cabinet.games[i].name,
        getSelectedIndex: () => cabinet.selectedIndex,
        onSelectNext: () => cabinet.selectNext(),
        onSelectPrev: () => cabinet.selectPrev(),
        onLaunch: () => {
            const entry = cabinet.games[cabinet.selectedIndex];
            app.renderer.resize(entry.screenWidth, entry.screenHeight);
            cabinet.launchSelected(app.stage);
        },
        onExit: () => {
            cabinet.exitToMenu();
            app.renderer.resize(CABINET_WIDTH, CABINET_HEIGHT);
        },
    };

    // ---- View --------------------------------------------------------------
    const cabinetContainer = createCabinetView(bindings);
    app.stage.addChild(cabinetContainer);

    // ---- Ticker ------------------------------------------------------------
    app.ticker.add((ticker) => {
        cabinet.update(ticker.deltaMS);
    });
}

main();
