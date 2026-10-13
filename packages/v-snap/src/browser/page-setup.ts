import * as fontkit from 'fontkit';
import { inject } from 'vitest';
import { checkCalibration } from './calibration';
import { installCanvasText } from './canvas-text';
import { monoFontUrl, sansFontUrl } from './fonts';
import { installHtmlRules } from './html-rules';
import { installSeededRandom } from './page-state';
import { loadViewKinds } from './view-kinds';

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
 * Sets the page up once, and returns the setup. It installs the seeded
 * `Math.random`, the test fonts, the canvas text and the HTML rules. Then
 * it checks the environment and the calibration set, once per run, and
 * stops the run if they do not match. Last, it loads the kinds of view that
 * the project's `vsnap.config.ts` registers. Every test file's setup awaits
 * the same promise.
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
    const resetRandom = installSeededRandom(SEED);
    const [sans, mono] = await Promise.all([loadFont(sansFontUrl), loadFont(monoFontUrl)]);
    const canvasText = installCanvasText({ sans, mono });
    await installHtmlRules();
    document.body.style.margin = '0';
    await checkCalibration(inject('visualPageKind'));
    // The project's vsnap.config.ts, and the modules it imports, load before
    // random numbers are reset, so that loading them can't shift the numbers
    // that the first test gets.
    await loadViewKinds();
    resetRandom();
    canvasText.takeUnpinnedFamilies();
    return {
        resetForTest: () => {
            resetRandom();
            // A test that failed before its font check leaves its families
            // behind, which the next test must not see
            canvasText.takeUnpinnedFamilies();
        },
        takeUnpinnedFamilies: canvasText.takeUnpinnedFamilies,
    };
}

const SEED = 0x5eed;

async function loadFont(url: string): Promise<fontkit.Font> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`v-snap couldn't load its test font from ${url}: the server answered ${response.status} ${response.statusText}. The test page loads it from v-snap's package, so check that Vite may serve files from there (server.fs.allow).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return fontkit.create(bytes as unknown as Buffer) as fontkit.Font;
}
