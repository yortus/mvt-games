import { Application, Container, RenderTexture, TextureSource, type Texture } from 'pixi.js';
import { CabinetView, createCabinetModel, type CabinetViewBindings } from './cabinet';
import { isTouchDevice, KeyboardInputView, PauseMenuView, TouchInputView } from '#common';
import {
    createAsteroidsEntry,
    createCactiiEntry,
    createDigdugEntry,
    createGalagaEntry,
    createIkEntry,
    createPacmanEntry,
    createScrambleEntry,
    type GameEntry,
    type GameSession,
} from './games';
import { setTickMethods, SKIP_DESCENDANTS, tickScene } from './pixi-mvt';

// ---------------------------------------------------------------------------
// Default cabinet dimensions (used for the menu screen)
// ---------------------------------------------------------------------------

const CABINET_WIDTH = 960;
const CABINET_HEIGHT = 540;

/** Height of the site navigation bar (must match --site-nav-height in nav.css). */
const NAV_HEIGHT = 48;

/** Returns the effective nav height (0 when hidden during gameplay). */
function getNavHeight(): number {
    const nav = document.querySelector('.site-nav') as HTMLElement | null;
    if (!nav) return 0;
    return nav.style.display === 'none' ? 0 : NAV_HEIGHT;
}

function setNavVisible(visible: boolean): void {
    const nav = document.querySelector('.site-nav') as HTMLElement | null;
    if (!nav) return;
    nav.style.display = visible ? '' : 'none';
    // Reclaim the body padding-top reserved for the fixed nav
    document.body.style.paddingTop = visible ? '' : '0';
}

/** Minimum margin (CSS px) reserved for touch controls when on a touch device. */
const MIN_TOUCH_MARGIN_CSS = 80;

/** Height (CSS px) reserved at the bottom for the pause / fullscreen button strip. */
const BUTTON_STRIP_PX = 48;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// Ensure all textures default to nearest-neighbor (blocky pixel-art look).
TextureSource.defaultOptions.scaleMode = 'nearest';

main();

async function main(): Promise<void> {
    const app = new Application();
    await app.init({
        width: CABINET_WIDTH,
        height: CABINET_HEIGHT,
        backgroundColor: 0x000000,
        antialias: false,
        roundPixels: true,
        sharedTicker: true,
    });
    document.body.appendChild(app.canvas);

    // Prevent pinch-zoom and scrolling on the game canvas on touch devices.
    app.canvas.style.touchAction = 'none';

    // Prevent double-tap zoom on the game canvas (some browsers ignore
    // touch-action for double-tap, so we explicitly block it).
    let lastTouchEnd = 0;
    app.canvas.addEventListener('touchend', (e) => {
        const now = e.timeStamp;
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });

    // ---- Game registry -----------------------------------------------------
    const games = [
        createAsteroidsEntry(),
        createCactiiEntry(),
        createDigdugEntry(),
        createGalagaEntry(),
        createIkEntry(),
        createPacmanEntry(),
        createScrambleEntry(),
    ];

    // ---- Cabinet model (must be created before view) -----------------------
    const cabinet = createCabinetModel({ games });

    // ---- Generate thumbnails -----------------------------------------------
    const thumbnails = await generateThumbnails(games, app);

    // ---- Game state --------------------------------------------------------
    let isCabinetScreen = true;
    let currentEntry: GameEntry | undefined;
    let currentSession: GameSession | undefined;
    let paused = false;
    let currentScale = 1;
    let currentCanvasW = CABINET_WIDTH;
    let currentCanvasH = CABINET_HEIGHT;
    let currentGameOffsetX = 0;
    let currentGameOffsetY = 0;

    // ---- Scene layers ------------------------------------------------------
    const gameContainer = new Container();
    gameContainer.label = 'game-container';
    app.stage.addChild(gameContainer);
    // The ticker ticks the whole stage once a frame (below), so pausing a game
    // is this container's call: while paused, the game's view is left out of
    // the update scene pass, and still refreshed, so it shows frozen under the
    // pause menu. No game knows about pause.
    setTickMethods(gameContainer, { update: () => (paused ? SKIP_DESCENDANTS : undefined) });

    // ---- URL fragment helpers --------------------------------------------
    function setUrlFragment(gameId: string | null): void {
        const url = gameId ? '#' + gameId : location.pathname + location.search;
        history.replaceState(null, '', url);
    }

    function doLaunchGame(): void {
        const entry = cabinet.games[cabinet.selectedIndex];
        currentEntry = entry;
        isCabinetScreen = false;
        if (isTouchDevice()) setNavVisible(false);
        setUrlFragment(entry.id);

        cabinet.launchSelected(gameContainer).then(() => {
            currentSession = cabinet.activeSession ?? undefined;
            // Ensure overlay layers render on top
            app.stage.addChild(cabinetContainer);
            app.stage.addChild(touchLayer);
            app.stage.addChild(pauseMenuContainer);
            updatePauseBtnVisibility();
            fitCanvasToScreen();
        });
        updatePauseBtnVisibility();
        fitCanvasToScreen();
    }

    /** The cabinet view sees the phase change, and zooms back out to the menu. */
    function doExitToMenu(): void {
        currentSession = undefined;
        currentEntry = undefined;
        touchLayer.visible = false;
        paused = false;
        cabinet.exitToMenu();
        isCabinetScreen = true;
        setNavVisible(true);
        setUrlFragment(null);
        updatePauseBtnVisibility();
        fitCanvasToScreen();
    }

    const bindings: CabinetViewBindings = {
        phase: () => cabinet.phase,
        gameCount: () => cabinet.games.length,
        gameNameAt: (i) => cabinet.games[i].name,
        gameThumbnailAt: (i) => thumbnails[i],
        selectedIndex: () => cabinet.selectedIndex,
        canvasWidth: () => currentCanvasW,
        canvasHeight: () => currentCanvasH,
        onMovePressed: (direction) => cabinet.selectByDelta(direction === 'left' ? -1 : 1),
        onLaunchPressed: doLaunchGame,
    };

    const cabinetContainer = CabinetView(bindings);
    app.stage.addChild(cabinetContainer);

    const touchLayer = new Container();
    touchLayer.label = 'touch-layer';
    touchLayer.visible = false;

    // Wire touch config and inputs to the game
    if (isTouchDevice()) {
        touchLayer.addChild(TouchInputView({
            canvasWidth: () => currentCanvasW,
            canvasHeight: () => currentCanvasH,
            gameX: () => currentGameOffsetX,
            gameY: () => currentGameOffsetY,
            gameWidth: () => currentEntry?.screenWidth ?? 0,
            gameHeight: () => currentEntry?.screenHeight ?? 0,
            scale: () => currentScale,
            hasDpad: () => currentSession?.inputConfig != null
                && (currentSession.inputConfig.showDpad ?? true),
            hasPrimaryButton: () => currentSession?.inputConfig?.showPrimary ?? false,
            hasSecondaryButton: () => currentSession?.inputConfig?.showSecondary ?? false,
            primaryLabel: () => currentSession?.inputConfig?.primaryLabel ?? 'A',
            secondaryLabel: () => currentSession?.inputConfig?.secondaryLabel ?? 'B',
            isJoystickFloating: () => currentSession?.inputConfig?.floatingJoystick ?? false,
            onXDirectionChanged: (dir) => currentSession?.inputConfig?.onXDirectionChanged?.(dir),
            onYDirectionChanged: (dir) => currentSession?.inputConfig?.onYDirectionChanged?.(dir),
            onPrimaryButtonChanged: (pressed) => currentSession?.inputConfig?.onPrimaryButtonChanged?.(pressed),
            onSecondaryButtonChanged: (pressed) => currentSession?.inputConfig?.onSecondaryButtonChanged?.(pressed),
        }));
    }

    // Wire keyboard inputs to the game
    app.stage.addChild(KeyboardInputView({
        onXDirectionChanged: (dir) => currentSession?.inputConfig?.onXDirectionChanged?.(dir),
        onYDirectionChanged: (dir) => currentSession?.inputConfig?.onYDirectionChanged?.(dir),
        onPrimaryButtonChanged: (pressed) => currentSession?.inputConfig?.onPrimaryButtonChanged?.(pressed),
        onSecondaryButtonChanged: (pressed) => currentSession?.inputConfig?.onSecondaryButtonChanged?.(pressed),
        onRestartButtonChanged: (pressed) => currentSession?.inputConfig?.onRestartButtonChanged?.(pressed),
    }));

    app.stage.addChild(touchLayer);

    const pauseMenuContainer = new Container();
    pauseMenuContainer.label = 'pause-menu-layer';
    pauseMenuContainer.addChild(PauseMenuView({
        canvasWidth: () => currentCanvasW,
        canvasHeight: () => currentCanvasH,
        gameX: () => currentGameOffsetX,
        gameY: () => currentGameOffsetY,
        gameWidth: () => currentEntry?.screenWidth ?? currentCanvasW,
        gameHeight: () => currentEntry?.screenHeight ?? currentCanvasH,
        scale: () => currentScale,
        isVisible: () => paused,
        onResumePressed: togglePause,
        onRestartPressed: restartGame,
        onExitPressed: doExitToMenu,
        howToPlayText: () => currentEntry?.instructions ?? '',
    }));
    app.stage.addChild(pauseMenuContainer);

    let orientationOverlay: HTMLDivElement | undefined;
    let pausedBeforeOverlay = false;

    // ---- Responsive scaling ------------------------------------------------
    function fitCanvasToScreen(): void {
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight - getNavHeight();
        const dpr = window.devicePixelRatio || 1;

        if (isCabinetScreen) {
            // Cabinet: use viewport pixels directly for responsive layout
            const logicalW = viewportW;
            const logicalH = viewportH;

            app.renderer.resolution = dpr;
            app.renderer.resize(logicalW, logicalH);
            app.canvas.style.width = `${viewportW}px`;
            app.canvas.style.height = `${viewportH}px`;

            cabinetContainer.position.set(0, 0);
            currentScale = 1;
            currentCanvasW = logicalW;
            currentCanvasH = logicalH;
        }
        else if (currentEntry) {
            const gameW = currentEntry.screenWidth;
            const gameH = currentEntry.screenHeight;

            // Reserve a strip at the bottom for pause / fullscreen buttons
            // so they never overlap the play area.
            const availH = viewportH - BUTTON_STRIP_PX;

            // Maximum scale that fits the game fully in the available area.
            const maxFitScale = Math.min(viewportW / gameW, availH / gameH);

            // Calculate scale, reserving margin for touch controls.
            // Compute both portrait (controls below) and landscape (controls
            // on sides) arrangements and pick whichever gives the larger game
            // so the scale transitions smoothly through square viewports.
            let scale = maxFitScale;
            if (isTouchDevice()) {
                // Portrait arrangement: reserve vertical space below for d-pad
                const portraitScale = Math.min(
                    viewportW / gameW,
                    (availH - MIN_TOUCH_MARGIN_CSS * 2) / gameH,
                );
                // Landscape arrangement: reserve horizontal space on sides
                const landscapeScale = Math.min(
                    (viewportW - MIN_TOUCH_MARGIN_CSS * 2) / gameW,
                    availH / gameH,
                );
                const scaleWithMargin = Math.max(portraitScale, landscapeScale);
                scale = Math.min(scale, Math.max(0.3, scaleWithMargin));
            }
            // Clamp at maxFitScale so the game never overflows the viewport,
            // even when the 0.3 minimum would push it larger than available.
            const effectiveScale = isTouchDevice()
                ? Math.min(maxFitScale, Math.max(0.3, scale))
                : currentEntry.integerScale
                    ? (scale < 1 ? scale : Math.max(1, Math.floor(scale)))
                    : scale;

            const logicalW = Math.ceil(viewportW / effectiveScale);
            const logicalH = Math.ceil(viewportH / effectiveScale);

            app.renderer.resolution = effectiveScale * dpr;
            app.renderer.resize(logicalW, logicalH);
            app.canvas.style.width = `${Math.floor(logicalW * effectiveScale)}px`;
            app.canvas.style.height = `${Math.floor(logicalH * effectiveScale)}px`;

            const offsetX = Math.floor((logicalW - gameW) / 2);
            let offsetY = Math.floor((logicalH - gameH) / 2);
            if (isTouchDevice() && viewportH > viewportW) {
                offsetY = 0;
            }
            gameContainer.position.set(offsetX, offsetY);

            currentCanvasW = logicalW;
            currentCanvasH = logicalH;
            currentScale = effectiveScale;
            currentGameOffsetX = offsetX;
            currentGameOffsetY = offsetY;

            // Touch view refreshes itself via watcher; just control visibility
            touchLayer.visible = isTouchDevice() && !!currentSession?.inputConfig && !paused;

            // Pause menu view refreshes itself via watcher
        }

        updateOrientationHint();
    }

    fitCanvasToScreen();
    window.addEventListener('resize', fitCanvasToScreen);

    // ---- Pause management ---------------------------------------------------
    function togglePause(): void {
        if (isCabinetScreen) return;
        if (orientationOverlay) return;
        paused = !paused;
        touchLayer.visible = isTouchDevice() && !!currentSession?.inputConfig && !paused;
    }

    function restartGame(): void {
        if (!currentEntry || !currentSession) return;
        paused = false;

        // Restart through the cabinet model so it tracks the new session
        cabinet.restartSession(gameContainer);
        currentSession = cabinet.activeSession ?? undefined;

        // Rebuild touch controls for the new session
        fitCanvasToScreen();
    }

    // ---- Escape key for pause ----------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !isCabinetScreen && currentSession) {
            e.preventDefault();
            if (orientationOverlay) {
                orientationOverlay.remove();
                orientationOverlay = undefined;
                paused = pausedBeforeOverlay;
                return;
            }
            togglePause();
        }
    });

    // ---- Utility buttons (bottom-right corner) ----------------------------
    const btnStyles = {
        border: '1px solid #555',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.5)',
        color: '#ccc',
        fontSize: '18px',
        cursor: 'pointer',
        lineHeight: '1',
        padding: '0',
        width: '36px',
        height: '36px',
    };

    // Pause button (visible during gameplay on touch devices)
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = '\u2759\u2759';
    pauseBtn.setAttribute('aria-label', 'Pause');
    Object.assign(pauseBtn.style, {
        ...btnStyles,
        position: 'fixed',
        bottom: '6px',
        right: '6px',
        zIndex: '10000',
        display: 'none',
    });
    document.body.appendChild(pauseBtn);
    pauseBtn.addEventListener('click', togglePause);

    function updatePauseBtnVisibility(): void {
        pauseBtn.style.display = !isCabinetScreen && currentSession ? '' : 'none';
    }

    // Fullscreen button (touch devices only)
    if (isTouchDevice() && document.fullscreenEnabled) {
        // Shift pause button left to make room for fullscreen
        pauseBtn.style.right = '48px';

        const fsBtn = document.createElement('button');
        fsBtn.textContent = '\u26F6';
        fsBtn.setAttribute('aria-label', 'Toggle fullscreen');
        Object.assign(fsBtn.style, {
            ...btnStyles,
            position: 'fixed',
            bottom: '6px',
            right: '6px',
            zIndex: '10000',
        });
        document.body.appendChild(fsBtn);

        fsBtn.addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            else {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        });

        document.addEventListener('fullscreenchange', () => {
            fsBtn.textContent = document.fullscreenElement ? '\u2716' : '\u26F6';
            fitCanvasToScreen();
        });
    }

    // ---- Responsive scaling ------------------------------------------------
    fitCanvasToScreen();
    window.addEventListener('resize', fitCanvasToScreen);

    // ---- Orientation guidance (touch devices only) -------------------------
    function updateOrientationHint(): void {
        if (!isTouchDevice()) return;

        const isPortrait = window.innerHeight > window.innerWidth;
        const needsLandscape = !isCabinetScreen && currentEntry !== undefined
            && currentEntry.screenWidth > currentEntry.screenHeight;

        const shouldShow = isPortrait && needsLandscape;

        if (shouldShow && !orientationOverlay) {
            pausedBeforeOverlay = paused;
            paused = true;
            orientationOverlay = document.createElement('div');
            Object.assign(orientationOverlay.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '10001',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                background: 'rgba(0,0,0,0.85)',
                color: '#ccc',
                fontFamily: 'monospace',
                fontSize: '16px',
                textAlign: 'center',
                padding: '24px',
            });
            orientationOverlay.innerHTML =
                '<div style="font-size:48px">\u{1F4F1}\u27F3</div>'
                + '<div>Rotate your device to landscape<br>for a better experience</div>'
                + '<button style="margin-top:8px;padding:8px 24px;background:#333;color:#ccc;'
                + 'border:1px solid #555;border-radius:6px;font-family:monospace;font-size:14px;cursor:pointer">'
                + 'Dismiss</button>';
            document.body.appendChild(orientationOverlay);
            orientationOverlay.querySelector('button')!.addEventListener('click', () => {
                if (orientationOverlay) {
                    orientationOverlay.remove();
                    orientationOverlay = undefined;
                    paused = pausedBeforeOverlay;
                }
            });
        }
        else if (!shouldShow && orientationOverlay) {
            orientationOverlay.remove();
            orientationOverlay = undefined;
            paused = pausedBeforeOverlay;
        }
    }

    // ---- Ticker ------------------------------------------------------------
    // Each frame ticks the models, then the whole stage: an update scene pass
    // and then a refresh scene pass, including while paused, so the pause
    // menu and the cabinet stay current (the game container sits out the
    // update scene pass while paused).
    app.ticker.add((ticker) => {
        if (!paused) {
            cabinet.update(ticker.deltaMS);
        }
        tickScene({ root: app.stage, deltaMs: ticker.deltaMS });
    });

    // ---- Auto-launch from URL fragment ------------------------------------
    const initialHash = location.hash.slice(1);
    if (initialHash) {
        const index = games.findIndex((g) => g.id === initialHash);
        if (index >= 0) {
            cabinet.selectByDelta(index - cabinet.selectedIndex);
            doLaunchGame();
        }
        else {
            setUrlFragment(null);
        }
    }
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
async function generateThumbnails(games: GameEntry[], app: Application): Promise<(Texture | undefined)[]> {
    const TICK_MS = 16;
    const thumbnails: (Texture | undefined)[] = [];
    for (let i = 0; i < games.length; i++) {
        const entry = games[i];
        try {
            await entry.load?.();

            const tempStage = new Container();
            const session = entry.start(tempStage);

            // Simulate many small ticks so state machines and GSAP
            // timelines advance correctly across phase boundaries. Each
            // advances the models and the views' presentation state; one
            // refresh scene pass at the end is all the snapshot needs.
            const totalMs = entry.thumbnailAdvanceMs ?? TICK_MS;
            let remaining = totalMs;
            while (remaining > 0) {
                const step = remaining < TICK_MS ? remaining : TICK_MS;
                session.update(step);
                tickScene({ root: tempStage, deltaMs: step, only: 'update' });
                remaining -= step;
            }
            tickScene({ root: tempStage, only: 'refresh' });

            const renderTexture = RenderTexture.create({
                width: entry.screenWidth,
                height: entry.screenHeight,
            });
            app.renderer.render({ container: tempStage, target: renderTexture });

            session.destroy();
            tempStage.destroy();

            thumbnails.push(renderTexture);
        }
        catch {
            thumbnails.push(undefined);
        }
    }
    return thumbnails;
}
