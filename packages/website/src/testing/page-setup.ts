import * as fontkit from 'fontkit';
import { inject } from 'vitest';
import { checkCalibration } from './calibration';
import { installCanvasText } from './canvas-text';
import { monoFontUrl, sansFontUrl } from './fonts';
import { installHtmlRules } from './html-rules';
import { installSeededRandom, patchPixiPools } from './page-state';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What a page sets up once, before its first test, and keeps. */
export interface PageSetup {
    /** Resets everything a test could have changed that the next must not see. */
    resetForTest: () => void;
    /** Canvas font families asked for since the last call that no test font stands in for. */
    takeUnpinnedFamilies: () => readonly string[];
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Sets the page up, once: the Pixi patch, the seeded `Math.random`, the test
 * fonts and canvas text, the HTML rules; then checks the environment and the
 * calibration set (once per run), and stops the run if they do not match.
 * Every test file's setup awaits the same promise.
 */
export function pageSetup(): Promise<PageSetup> {
    setup ??= setUp();
    return setup;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

let setup: Promise<PageSetup> | undefined;

async function setUp(): Promise<PageSetup> {
    patchPixiPools();
    const resetRandom = installSeededRandom(SEED);
    const [sans, mono] = await Promise.all([loadFont(sansFontUrl), loadFont(monoFontUrl)]);
    const canvasText = installCanvasText({ sans, mono });
    await installHtmlRules();
    document.body.style.margin = '0';
    await checkCalibration(inject('visualKind'));
    resetRandom();
    canvasText.takeUnpinnedFamilies();
    return { resetForTest: resetRandom, takeUnpinnedFamilies: canvasText.takeUnpinnedFamilies };
}

const SEED = 0x5eed;

async function loadFont(url: string): Promise<fontkit.Font> {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    return fontkit.create(bytes as unknown as Buffer) as fontkit.Font;
}
