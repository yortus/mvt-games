import { Application, Container, Graphics, RenderTexture, Text, TextureSource, type Texture } from 'pixi.js';
import { createCabinetModel, createCabinetView, type CabinetViewBindings } from './cabinet';
import {
    createKeyboardInputView,
    createPauseMenuView,
    createTouchInputView,
    isTouchDevice,
} from '#common';
import {
    createAsteroidsEntry,
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

/** Pause button size in CSS pixels. */
const PAUSE_BTN_CSS = 36;

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

    const bindings: CabinetViewBindings = {
        getPhase: () => cabinet.phase,
        getGameCount: () => cabinet.games.length,
        getGameName: (i) => cabinet.games[i].name,
        getGameThumbnail: (i) => thumbnails[i],
        getSelectedIndex: () => cabinet.selectedIndex,
        getCanvasWidth: () => currentCanvasW,
        getCanvasHeight: () => currentCanvasH,
        onMovePressed: (direction) => cabinet.selectByDelta(direction === 'left' ? -1 : 1),
        onLaunchPressed: () => {
            const entry = cabinet.games[cabinet.selectedIndex];
            currentEntry = entry;
            isCabinetScreen = false;
            if (isTouchDevice()) setNavVisible(false);

            cabinet.launchSelected(gameContainer).then(() => {
                currentSession = cabinet.activeSession ?? undefined;
                // Ensure overlay layers render on top
                app.stage.addChild(cabinetContainer);
                app.stage.addChild(touchLayer);
                app.stage.addChild(pauseBtnContainer);
                app.stage.addChild(pauseMenuContainer);
                fitCanvasToScreen();
            });
            fitCanvasToScreen();
        },
        onExitPressed: () => {
            currentSession = undefined;
            currentEntry = undefined;
            touchLayer.visible = false;
            pauseBtnContainer.visible = false;
            paused = false;
            cabinet.exitToMenu();
            isCabinetScreen = true;
            setNavVisible(true);
            fitCanvasToScreen();
        },
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
            getShowDpad: () => currentSession?.inputConfig != null &&
                (currentSession.inputConfig.showDpad ?? true),
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

    const pauseBtnContainer = new Container();
    pauseBtnContainer.label = 'pause-button';
    pauseBtnContainer.visible = false;
    app.stage.addChild(pauseBtnContainer);

    const pauseMenuContainer = new Container();
    pauseMenuContainer.label = 'pause-menu-layer';
    pauseMenuContainer.addChild(createPauseMenuView({
        getCanvasWidth: () => currentCanvasW,
        getCanvasHeight: () => currentCanvasH,
        getScale: () => currentScale,
        getVisible: () => paused,
        onResumePressed: togglePause,
        onRestartPressed: restartGame,
        onExitPressed: exitToCabinet,
    }));
    app.stage.addChild(pauseMenuContainer);

    let orientationOverlay: HTMLDivElement | undefined;

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
            const effectiveScale = isTouchDevice() ?
                    Math.max(0.3, scale) :
                    (scale < 1 ? scale : Math.max(1, Math.floor(scale)));

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

            // Reposition pause button
            rebuildPauseButton(logicalW, logicalH, offsetX, offsetY, gameW, gameH, effectiveScale);

            // Pause menu view refreshes itself via watcher
        }

        updateOrientationHint();
    }

    fitCanvasToScreen();
    window.addEventListener('resize', fitCanvasToScreen);

    // ---- Pause button management -------------------------------------------
    function rebuildPauseButton(
        canvasW: number, canvasH: number,
        gameX: number, gameY: number,
        gameW: number, gameH: number,
        scale: number,
    ): void {
        while (pauseBtnContainer.children.length > 0) {
            pauseBtnContainer.removeChildAt(0).destroy({ children: true });
        }

        if (!currentSession) {
            pauseBtnContainer.visible = false;
            return;
        }

        const btnSize = Math.round(PAUSE_BTN_CSS / scale);
        const margin = Math.round(8 / scale);

        // Portrait: centred in the controls strip below the game, on the
        //   same horizontal line as d-pad and fire buttons.
        // Landscape: same vertical line as fire buttons (right-margin centre),
        //   near the top of the game area.
        const isPortrait = window.innerHeight > window.innerWidth;
        let bx: number;
        let by: number;
        if (isPortrait) {
            const controlsTop = gameY + gameH;
            bx = Math.floor(canvasW / 2 - btnSize / 2);
            by = controlsTop + Math.floor((canvasH - controlsTop) / 2 - btnSize / 2);
        }
        else {
            const rightStart = gameX + gameW;
            const rightCenterX = rightStart + (canvasW - rightStart) / 2;
            bx = Math.floor(rightCenterX - btnSize / 2);
            by = gameY + margin;
        }

        const bg = new Graphics();
        bg.roundRect(0, 0, btnSize, btnSize, 4)
            .fill({ color: 0x000000, alpha: 0.5 });
        bg.roundRect(0, 0, btnSize, btnSize, 4)
            .stroke({ color: 0x888888, width: 1 });
        bg.position.set(bx, by);
        bg.eventMode = 'static';
        bg.cursor = 'pointer';
        pauseBtnContainer.addChild(bg);

        const icon = new Text({
            text: '\u2759\u2759',
            style: { fontFamily: 'monospace', fontSize: Math.round(btnSize * 0.5), fill: 0xffffff },
        });
        icon.anchor.set(0.5, 0.5);
        icon.position.set(bx + btnSize / 2, by + btnSize / 2);
        pauseBtnContainer.addChild(icon);

        bg.on('pointerdown', togglePause);
        pauseBtnContainer.visible = true;
    }

    // ---- Pause management ---------------------------------------------------
    function togglePause(): void {
        if (isCabinetScreen) return;
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
        pauseBtnContainer.visible = false;

        cabinetContainer.requestExit();
    }

    // ---- Escape key for pause ----------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !isCabinetScreen && currentSession) {
            e.preventDefault();
            togglePause();
        }
    });

    // ---- Fullscreen toggle (touch devices only) ----------------------------
    if (isTouchDevice() && document.fullscreenEnabled) {
        const fsBtn = document.createElement('button');
        fsBtn.textContent = '\u26F6';
        fsBtn.setAttribute('aria-label', 'Toggle fullscreen');
        Object.assign(fsBtn.style, {
            position: 'fixed',
            bottom: '6px',
            right: '6px',
            zIndex: '10000',
            width: '36px',
            height: '36px',
            border: '1px solid #555',
            borderRadius: '6px',
            background: 'rgba(0,0,0,0.5)',
            color: '#ccc',
            fontSize: '18px',
            cursor: 'pointer',
            lineHeight: '1',
            padding: '0',
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
        const needsLandscape = !isCabinetScreen && currentEntry !== undefined &&
            currentEntry.screenWidth > currentEntry.screenHeight;

        const shouldShow = isPortrait && needsLandscape;

        if (shouldShow && !orientationOverlay) {
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
                '<div style="font-size:48px">\u{1F4F1}\u27F3</div>' +
                '<div>Rotate your device to landscape<br>for a better experience</div>' +
                '<button style="margin-top:8px;padding:8px 24px;background:#333;color:#ccc;' +
                'border:1px solid #555;border-radius:6px;font-family:monospace;font-size:14px;cursor:pointer">' +
                'Dismiss</button>';
            document.body.appendChild(orientationOverlay);
            orientationOverlay.querySelector('button')!.addEventListener('click', () => {
                if (orientationOverlay) {
                    orientationOverlay.remove();
                    orientationOverlay = undefined;
                }
            });
        }
        else if (!shouldShow && orientationOverlay) {
            orientationOverlay.remove();
            orientationOverlay = undefined;
        }
    }

    // ---- Ticker ------------------------------------------------------------
    app.ticker.add((ticker) => {
        if (!paused) {
            cabinet.update(ticker.deltaMS);
        }
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
