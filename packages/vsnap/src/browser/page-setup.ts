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

/** The state that a page sets up once, before its first test, and keeps. */
export interface PageSetup {
    /** Resets everything that a test could have changed and that the next test must not see. */
    resetForTest: () => void;
    /** Returns the canvas font families asked for since the last call that no test font stands in for. */
    takeUnpinnedFamilies: () => readonly string[];
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

/**
 * Sets the page up once, and returns the setup. It installs the Pixi patch,
 * the seeded `Math.random`, the test fonts, the canvas text and the HTML
 * rules. Then it checks the environment and the calibration set, once per
 * run, and stops the run if they do not match. Every test file's setup
 * awaits the same promise.
 */
export function setUpPage(): Promise<PageSetup> {
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
