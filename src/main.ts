import { Application, Container, RenderTexture, TextureSource, type Texture } from 'pixi.js';
import { createCabinetModel, createCabinetView, type CabinetViewBindings } from './cabinet';
import {
    createKeyboardInputView,
    createPauseMenuView,
    createTouchInputView,
    isTouchDevice,
} from '#common';
import {
    createAsteroidsEntry,
    createCupcakesEntry,
    createDigdugEntry,
    createGalagaEntry,
    createIkEntry,
    createPacmanEntry,
    createScrambleEntry,
    type GameEntry,
    type GameSession,
} from './games';

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
        createCupcakesEntry(),
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
        getPhase: () => cabinet.phase,
        getGameCount: () => cabinet.games.length,
        getGameName: (i) => cabinet.games[i].name,
        getGameThumbnail: (i) => thumbnails[i],
        getSelectedIndex: () => cabinet.selectedIndex,
        getCanvasWidth: () => currentCanvasW,
        getCanvasHeight: () => currentCanvasH,
        onMovePressed: (direction) => cabinet.selectByDelta(direction === 'left' ? -1 : 1),
        onLaunchPressed: doLaunchGame,
        onExitPressed: doExitToMenu,
    };

    const cabinetContainer = createCabinetView(bindings);
    app.stage.addChild(cabinetContainer);

    const touchLayer = new Container();
    touchLayer.label = 'touch-layer';
    touchLayer.visible = false;

    // Wire touch config and inputs to the game
    if (isTouchDevice()) {
        touchLayer.addChild(createTouchInputView({
            getCanvasWidth: () => currentCanvasW,
            getCanvasHeight: () => currentCanvasH,
            getGameX: () => currentGameOffsetX,
            getGameY: () => currentGameOffsetY,
            getGameWidth: () => currentEntry?.screenWidth ?? 0,
            getGameHeight: () => currentEntry?.screenHeight ?? 0,
            getScale: () => currentScale,
            getShowDpad: () => currentSession?.inputConfig != null
                && (currentSession.inputConfig.showDpad ?? true),
            getShowPrimary: () => currentSession?.inputConfig?.showPrimary ?? false,
            getShowSecondary: () => currentSession?.inputConfig?.showSecondary ?? false,
            getPrimaryLabel: () => currentSession?.inputConfig?.primaryLabel ?? 'A',
            getSecondaryLabel: () => currentSession?.inputConfig?.secondaryLabel ?? 'B',
            getFloatingJoystick: () => currentSession?.inputConfig?.floatingJoystick ?? false,
            onXDirectionChanged: (dir) => currentSession?.inputConfig?.onXDirectionChanged?.(dir),
            onYDirectionChanged: (dir) => currentSession?.inputConfig?.onYDirectionChanged?.(dir),
            onPrimaryButtonChanged: (pressed) => currentSession?.inputConfig?.onPrimaryButtonChanged?.(pressed),
            onSecondaryButtonChanged: (pressed) => currentSession?.inputConfig?.onSecondaryButtonChanged?.(pressed),
        }));
    }

    // Wire keyboard inputs to the game
    app.stage.addChild(createKeyboardInputView({
        onXDirectionChanged: (dir) => currentSession?.inputConfig?.onXDirectionChanged?.(dir),
        onYDirectionChanged: (dir) => currentSession?.inputConfig?.onYDirectionChanged?.(dir),
        onPrimaryButtonChanged: (pressed) => currentSession?.inputConfig?.onPrimaryButtonChanged?.(pressed),
        onSecondaryButtonChanged: (pressed) => currentSession?.inputConfig?.onSecondaryButtonChanged?.(pressed),
        onRestartButtonChanged: (pressed) => currentSession?.inputConfig?.onRestartButtonChanged?.(pressed),
    }));

    app.stage.addChild(touchLayer);

    const pauseMenuContainer = new Container();
    pauseMenuContainer.label = 'pause-menu-layer';
    pauseMenuContainer.addChild(createPauseMenuView({
        getCanvasWidth: () => currentCanvasW,
        getCanvasHeight: () => currentCanvasH,
        getGameX: () => currentGameOffsetX,
        getGameY: () => currentGameOffsetY,
        getGameWidth: () => currentEntry?.screenWidth ?? currentCanvasW,
        getGameHeight: () => currentEntry?.screenHeight ?? currentCanvasH,
        getScale: () => currentScale,
        getVisible: () => paused,
        onResumePressed: togglePause,
        onRestartPressed: restartGame,
        onExitPressed: exitToCabinet,
        getHowToPlayText: () => currentEntry?.instructions ?? '',
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

            // Calculate scale, reserving margin for touch controls on the
            // correct axis: portrait puts controls below, landscape on sides.
            let scale = Math.min(viewportW / gameW, viewportH / gameH);
            if (isTouchDevice()) {
                const isPortrait = viewportH > viewportW;
                let scaleWithMargin: number;
                if (isPortrait) {
                    // Reserve space below for d-pad / pause / fire strip
                    scaleWithMargin = Math.min(
                        viewportW / gameW,
                        (viewportH - MIN_TOUCH_MARGIN_CSS * 2) / gameH,
                    );
                }
                else {
                    // Reserve space on both sides for d-pad (left) and buttons (right)
                    scaleWithMargin = Math.min(
                        (viewportW - MIN_TOUCH_MARGIN_CSS * 2) / gameW,
                        viewportH / gameH,
                    );
                }
                scale = Math.min(scale, Math.max(0.3, scaleWithMargin));
            }
            const effectiveScale = isTouchDevice()
                ? Math.max(0.3, scale)
                : (scale < 1 ? scale : Math.max(1, Math.floor(scale)));

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

    function exitToCabinet(): void {
        paused = false;
        touchLayer.visible = false;

        cabinetContainer.requestExit();
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
    app.ticker.add((ticker) => {
        if (!paused) {
            cabinet.update(ticker.deltaMS);
        }
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
        }
        catch {
            thumbnails.push(undefined);
        }
    }
    return thumbnails;
}
