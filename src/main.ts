import { Application, Container, RenderTexture, type Texture } from 'pixi.js';
import { createCabinetModel, createCabinetView, type CabinetViewBindings } from './cabinet';
import {
    createAsteroidsEntry,
    createDigdugEntry,
    createGalagaEntry,
    createPacmanEntry,
    type GameEntry,
} from './games';

// ---------------------------------------------------------------------------
// Default cabinet dimensions (used for the menu screen)
// ---------------------------------------------------------------------------

const CABINET_WIDTH = 480;
const CABINET_HEIGHT = 360;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

main();

async function main(): Promise<void> {
    const app = new Application();
    await app.init({
        width: CABINET_WIDTH,
        height: CABINET_HEIGHT,
        backgroundColor: 0x000000,
        antialias: false,
        roundPixels: true,
    });
    document.body.appendChild(app.canvas);

    // ---- Game registry -----------------------------------------------------
    const games = [createAsteroidsEntry(), createDigdugEntry(), createGalagaEntry(), createPacmanEntry()];

    // ---- Generate thumbnails -----------------------------------------------
    const thumbnails = await generateThumbnails(games, app);

    // ---- Cabinet model -----------------------------------------------------
    const cabinet = createCabinetModel({ games });

    // ---- Bindings (Cabinet Model → Cabinet View) ---------------------------
    const bindings: CabinetViewBindings = {
        getPhase: () => cabinet.phase,
        getGameCount: () => cabinet.games.length,
        getGameName: (i) => cabinet.games[i].name,
        getGameThumbnail: (i) => thumbnails[i],
        getSelectedIndex: () => cabinet.selectedIndex,
        onNavigate: (delta) => cabinet.selectByDelta(delta),
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

// ---------------------------------------------------------------------------
// Thumbnail Generation
// ---------------------------------------------------------------------------

/**
 * For each game, create a temporary model + view, render one frame to a
 * RenderTexture, then tear down the session. This leverages the MVT
 * decoupling: the same views that run at 60 fps produce a static
 * snapshot when rendered exactly once.
 *
 * Time is advanced in small 16 ms steps (not one giant leap) because
 * models contain multi-phase state machines and GSAP timelines that
 * depend on inter-tick transitions - see the MVT guide § "update(deltaMs)
 * Contract" for details.
 */
async function generateThumbnails(
    games: GameEntry[],
    app: Application,
): Promise<(Texture | undefined)[]> {
    const TICK_MS = 16;
    const thumbnails: (Texture | undefined)[] = [];
    for (let i = 0; i < games.length; i++) {
        const entry = games[i];
        try {
            if (entry.preload) await entry.preload();

            const tempStage = new Container();
            const session = entry.start(tempStage);

            // Simulate many small ticks so state machines and GSAP
            // timelines advance correctly across phase boundaries.
            const totalMs = entry.thumbnailAdvanceMs ?? TICK_MS;
            let remaining = totalMs;
            while (remaining > 0) {
                const step = remaining < TICK_MS ? remaining : TICK_MS;
                session.update(step);
                remaining -= step;
            }

            const renderTexture = RenderTexture.create({
                width: entry.screenWidth,
                height: entry.screenHeight,
            });
            app.renderer.render({ container: tempStage, target: renderTexture });

            session.destroy();
            tempStage.destroy();

            thumbnails.push(renderTexture);
        } catch {
            thumbnails.push(undefined);
        }
    }
    return thumbnails;
}
