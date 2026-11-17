import * as fontkit from 'fontkit';
import { inject } from 'vitest';
import type { ProvidedFontFamily } from '../protocol';
import { checkCalibration } from './calibration';
import { installCanvasText, type RegisteredFamily } from './canvas-text';
import { monoFontUrl, sansFontUrl } from './fonts';
import { installHtmlRules } from './html-rules';
import { installSeededRandom } from './page-state';
import { watchShadowRoots } from './shadow-roots';
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
 * Sets the page up once, and returns the setup. It starts keeping the
 * page's shadow roots (see `watchShadowRoots`), then installs the seeded
 * `Math.random`, the test fonts, the canvas text and the HTML rules. Then
 * it checks the environment and the calibration set, once per run, and
 * stops the run if they do not match. Then it registers the project's own
 * fonts, which it loaded with the test fonts. Last, it loads the kinds of
 * view that the project's `vsnap.config.ts` registers. Every test file's
 * setup awaits the same promise.
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
    // Before any view's code runs, so that every shadow root is seen.
    watchShadowRoots();
    const resetRandom = installSeededRandom(SEED);
    const [sans, mono, families] = await Promise.all([loadTestFont(sansFontUrl), loadTestFont(monoFontUrl), loadFamilies(inject('vsnapFonts'))]);
    const canvasText = installCanvasText({ sans, mono });
    await installHtmlRules();
    document.body.style.margin = '0';
    await checkCalibration(inject('vsnapPageKind'));
    // After the calibration set, which checks that the test fonts draw alike
    // on this machine, so that a project's own font for a generic family
    // can't change it. Before any of the project's code, which may draw text
    // as it loads, and cache it for the page's life.
    canvasText.registerFamilies(families);
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

async function loadTestFont(url: string): Promise<fontkit.Font> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`v-snap couldn't load its test font from ${url}: the server answered ${response.status} ${response.statusText}. The test page loads it from v-snap's package, so check that Vite may serve files from there (server.fs.allow).`);
    }
    return readFont(response);
}

/** Loads the faces of the families that the project registers, which Node has checked. */
async function loadFamilies(provided: readonly ProvidedFontFamily[]): Promise<RegisteredFamily[]> {
    return Promise.all(provided.map(async (family) => ({
        name: family.family,
        faces: await Promise.all(family.faces.map(async (face) => {
            const response = await fetch(face.url);
            if (!response.ok) {
                throw new Error(`v-snap couldn't load the font file for ${family.family}, ${face.file}: the server answered ${response.status} ${response.statusText}. Check that Vite may serve files from its folder (server.fs.allow).`);
            }
            return { font: await readFont(response), weight: face.weight, isItalic: face.style === 'italic' };
        })),
    })));
}

async function readFont(response: Response): Promise<fontkit.Font> {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return fontkit.create(bytes as unknown as Buffer) as fontkit.Font;
}
