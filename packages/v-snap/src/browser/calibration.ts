import { inject } from 'vitest';
import { type Calibration, CANVAS_CALIBRATION, type CanvasCalibration, SAMPLE } from './canvas-calibration';
import { captureHtmlImage } from './html-image';
import { describeDifference, hashPixels, isPass, openSession, toBase64, visualCommands } from './judge';
import type { VisualEnvironment, PageKind, VisualVerdict } from '../protocol';
import { isAllOne } from '../shared';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Checks that this machine is the reference environment, before any test
 * runs. First it checks the browser's facts. Then it draws a calibration set
 * of small images. Each one exercises one way that an image can differ
 * between machines. If anything differs beyond the tolerance, the run stops
 * with one error that says what differs. That is clearer than failing every
 * test for one reason that nobody can see. In `environment` mode, it writes
 * the facts and the calibration set's references instead. It runs once per
 * run for each kind of page.
 */
export async function checkCalibration(pageKind: PageKind): Promise<void> {
    const session = await openSession({ calibration: pageKind });
    if (session.isCalibrated) return;
    // Only Playwright's headless Chromium, which v-snap sets up, says
    // HeadlessChrome. A headed browser, as with --browser.headless=false, or
    // another browser draws differently, which no Playwright version fixes.
    if (!navigator.userAgent.includes('HeadlessChrome')) {
        const message = `The visual tests (${pageKind}) run in Playwright's headless Chromium, which v-snap sets up, but this page runs in another browser (${navigator.userAgent}), `
            + 'such as a headed one, with --browser.headless=false, or one that the config names. It would draw the images differently, so no actual image of a test was compared. '
            + 'Run the visual tests headless. To look at a view, open its actual image in .vitest/vsnap/, or the failed test in the Vitest UI.';
        await visualCommands.abortVisualRun(message);
        throw new Error(message);
    }
    const problems = [...await visualCommands.checkVisualEnvironment(readEnvironment())];
    const calibrations = pageKind === 'canvas' ? CANVAS_JUDGED : HTML_CALIBRATION;
    if (problems.length === 0) {
        for (const [name, draw] of Object.entries(calibrations)) {
            const verdict = await draw(name, session.hashes[name]);
            if (!isPass(verdict)) {
                const detail = verdict.outcome === 'differs' ? describeDifference(verdict) : verdict.outcome;
                problems.push(`the calibration image '${name}' differs (${detail}), as ${verdict.diffFile ?? verdict.actualFile} shows`);
            }
        }
    }
    if (problems.length > 0) {
        const message = `This machine is not the visual tests' reference environment (${pageKind}). These checks failed: ${problems.join('; ')}. `
            + 'No test\'s actual image was compared. v-snap draws with the browser of one Playwright version, so check that the project installs the Playwright version that v-snap\'s package.json names, and only one copy of it.';
        await visualCommands.abortVisualRun(message);
        throw new Error(message);
    }
    await visualCommands.recordVisualCalibration({ pageKind, names: Object.keys(calibrations) });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Returns a canvas calibration image that judges itself against its
 * expected hash. Only an image whose hash differs goes to Node.
 */
function judgeCanvasCalibration(draw: CanvasCalibration): Calibration {
    return async (name, expectedHash): Promise<VisualVerdict> => {
        const image = draw();
        // A blank image would hide a drawing that failed, such as a shader
        // that didn't compile on this machine
        if (isAllOne(image.pixels)) throw new Error(`The calibration image '${name}' is blank. Something it draws with failed on this machine.`);
        const hash = await hashPixels(image.width, image.height, image.pixels);
        if (hash === expectedHash) return { outcome: 'same', referenceFile: name };
        return visualCommands.judgeVisualMismatch({
            calibration: 'canvas', name, test: `calibration ${name}`,
            width: image.width, height: image.height, hash, pixels: toBase64(image.pixels),
        });
    };
}

const CANVAS_JUDGED: Readonly<Record<string, Calibration>> = Object.fromEntries(
    Object.entries(CANVAS_CALIBRATION).map(([name, draw]) => [name, judgeCanvasCalibration(draw)]),
);

function readEnvironment(): VisualEnvironment {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
        browser: /HeadlessChrome\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? navigator.userAgent,
        webglRenderer: info !== undefined && info !== null && gl !== null ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'none',
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        devicePixelRatio,
    };
}

/** Creates a calibration image made of HTML markup. */
function createHtmlCalibration(markup: string): Calibration {
    return async (name) => {
        const root = document.createElement('div');
        root.style.cssText = 'padding:8px;color:#e6edf3;font-size:14px;';
        root.innerHTML = markup;
        return captureHtmlImage(root, { maxPixels: inject('vsnapMaxPixels') }, { calibration: 'html', name, test: `calibration ${name}` });
    };
}

const HTML_CALIBRATION: Readonly<Record<string, Calibration>> = {
    'blank-text': createHtmlCalibration([10, 13, 13.5, 16, 17.3, 24].map((size) => `<div style="font-size:${size}px;width:max-content;border:1px solid #58a6ff;margin:2px 0">${SAMPLE}</div>`).join('')
        + '<p style="width:200px;border:1px solid #ffe45c;line-height:1.4">Wrapping text, with emoji 😀 and 漢字, in a narrow box.</p>'),
    'boxes': createHtmlCalibration(`<div style="display:flex;gap:16px">
        <div style="width:90px;height:60px;border-radius:14px 4px 22px 8px;background:linear-gradient(135deg,#ff4f8b,#ffe45c)"></div>
        <div style="width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#fff,#2a1766);box-shadow:0 6px 14px rgba(0,0,0,.6)"></div>
        <div style="width:60px;height:40px;border:3px dashed #5bd1ff;outline:2px solid #58a6ff;outline-offset:3px"></div></div>`),
    'rotated': createHtmlCalibration(`<div style="display:flex;gap:24px;padding:12px">
        <div style="width:60px;height:40px;background:#ffe45c;transform:rotate(7deg)"></div>
        <div style="perspective:200px"><div style="width:60px;height:40px;background:#ff4f8b;transform:rotateY(35deg)"></div></div>
        <img style="width:80px;height:60px;transform:rotate(-3deg)" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#2a1766"/><circle cx="20" cy="15" r="10" fill="#5bd1ff"/></svg>')}"></div>`),
    'filters': createHtmlCalibration(`<div style="display:flex;gap:18px;padding:10px;background:linear-gradient(90deg,#123,#456)">
        <div style="width:50px;height:50px;background:#ffe45c;filter:blur(3px)"></div>
        <div style="width:50px;height:50px;background:#5bd1ff;filter:drop-shadow(4px 4px 3px #000)"></div>
        <div style="width:50px;height:50px;backdrop-filter:blur(4px);border:1px solid #fff"></div></div>`),
    'controls': createHtmlCalibration(createControlsMarkup('light')),
    // A page that asks for dark controls, with CSS's color-scheme, gets the
    // browser's dark ones
    'controls-dark': createHtmlCalibration(createControlsMarkup('dark')),
};

/** Returns markup with one of each kind of form control, in a colour scheme. */
function createControlsMarkup(scheme: 'light' | 'dark'): string {
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:520px;color-scheme:${scheme}">
        <input type="checkbox" checked><input type="radio" checked><input type="range" value="30">
        <progress value="0.4"></progress><button>Button</button><select><option>Option</option></select>
        <input type="text" value="Text field"><textarea rows="2" cols="12">Two lines</textarea></div>`;
}
