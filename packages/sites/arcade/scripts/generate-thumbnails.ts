/**
 * Photographs every entry for its card in the arcade, and for its link
 * preview.
 *
 * Usage:  npm run generate-thumbnails [-- <id> ...]
 *
 * Opens the snapshot page (`snapshot.html`, `src/snapshot.ts`) in one
 * headless Chrome, once for each entry, and saves two pictures of what it
 * shows in the entry's `start/` directory:
 *
 * - `thumbnail.webp`, for its card: the whole play area, at the size that
 *   makes the longer side of the entry's crop (`thumbnailCrop`, the part its
 *   card shows) CROP_PIXELS long.
 * - `share.png`, for its link preview: the whole play area, as large as fits
 *   in 1200 by 630 pixels, on the Arcade's background (see `share-image.ts`).
 *   A picture too large as a PNG is saved as `share.jpg` instead.
 *
 * Then it photographs the Arcade's card wall, as a visitor first sees it, for
 * the link preview of the Arcade and of the rest of the site:
 * `src/arcade/share.jpg`. It is always a JPEG, at an address the docs and the
 * playground name too.
 *
 * The images are committed, like the textures: rerun this when an entry
 * changes how it looks, or its crop. Give ids to photograph only those
 * entries, and `arcade` for the card wall.
 *
 * It uses the Arcade's dev server if one is running, and starts one if not.
 * A second dev server would prepare the shared dependency cache again, under
 * the running one, which then fails to serve its pages until restarted.
 */

import { rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { findEntryDirectories } from './entry-facts.ts';
import { type HeadlessChrome, launchHeadlessChrome } from './headless-chrome.ts';
import {
    SHARE_IMAGE_BACKGROUND,
    SHARE_IMAGE_HEIGHT,
    SHARE_IMAGE_MAX_BYTES,
    SHARE_IMAGE_NAMES,
    SHARE_IMAGE_WIDTH,
} from './share-image.ts';

/** A card's photo at its largest, at twice the density of a typical card's width in CSS pixels. */
const CROP_PIXELS = 600;
const WEBP_QUALITY = 82;
/** For a share image too large as a PNG. */
const JPEG_QUALITY = 0.9;
/** Where `npm run dev` serves the Arcade. */
const DEV_SERVER_URL = 'http://localhost:5173/';
/** What to name to photograph the Arcade's card wall. */
const ARCADE_ID = 'arcade';
/** Waits for the card wall's fonts, and for the photos of the cards in view, then for two frames to reach the screen. */
const WAIT_FOR_WALL = `(async () => {
    await document.fonts.ready;
    const isInView = (img) => {
        const box = img.getBoundingClientRect();
        return box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    };
    for (let i = 0; i < 200; i++) {
        const images = [...document.images].filter(isInView);
        if (images.length > 0 && images.every((img) => img.complete)) break;
        await new Promise((done) => setTimeout(done, 50));
    }
    await new Promise((done) => setTimeout(done, 500));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
})()`;

const arcadeDir = resolve(import.meta.dirname, '..');
const entryDirs = findEntryDirectories(join(arcadeDir, 'src'));

const running = await isServing(`${DEV_SERVER_URL}snapshot.html`);
let server: ViteDevServer | undefined;
if (!running) {
    server = await createServer({
        configFile: join(arcadeDir, 'vite.config.ts'),
        server: { host: '127.0.0.1', port: 5190, strictPort: false },
        logLevel: 'warn',
    });
    await server.listen();
}
const baseUrl = running ? DEV_SERVER_URL : server?.resolvedUrls?.local[0];
if (baseUrl === undefined) throw new Error('The dev server has no local URL');
console.log(running ? `Using the dev server at ${baseUrl}` : `Started a dev server at ${baseUrl}`);

const browser = await launchHeadlessChrome();
try {
    await browser.navigate(`${baseUrl}snapshot.html`);
    const { entries } = await browser.evaluate<{
        entries: { id: string; width: number; height: number; cropWidth: number; cropHeight: number }[];
    }>(
        'window.snapshot',
    );
    const requested = process.argv.slice(2);
    const ids = requested.length > 0 ? requested : [...entries.map((entry) => entry.id), ARCADE_ID];

    // Written once every entry is photographed: the dev server reloads the
    // snapshot page when a thumbnail it imports changes, which would stop a
    // photo halfway
    const pictures: Picture[] = [];
    for (const id of ids) {
        if (id === ARCADE_ID) continue;
        const dir = entryDirs[id];
        const entry = entries.find((e) => e.id === id);
        if (dir === undefined || entry === undefined) throw new Error(`No entry '${id}'`);

        // The viewport is the entry's play area, which one that follows the viewport lays itself out to fill
        await browser.send('Emulation.setDeviceMetricsOverride', {
            width: Math.round(entry.width),
            height: Math.round(entry.height),
            deviceScaleFactor: 1,
            mobile: false,
        });
        await browser.navigate(`${baseUrl}snapshot.html?entry=${encodeURIComponent(id)}`);
        const { rect } = await browser.evaluate<{ rect: { x: number; y: number; width: number; height: number } }>('window.snapshot');

        // The rectangle is in the entry's own pixels, which the crop is measured in
        const scale = CROP_PIXELS / Math.max(entry.cropWidth, entry.cropHeight);
        const { data } = await browser.send<{ data: string }>('Page.captureScreenshot', {
            format: 'webp',
            quality: WEBP_QUALITY,
            clip: { ...rect, scale },
        });
        const size = `${Math.round(rect.width * scale)}x${Math.round(rect.height * scale)}`;
        pictures.push({ id, file: join(dir, 'start', 'thumbnail.webp'), bytes: Buffer.from(data, 'base64'), size });

        // Photographed again at the scale that fits the share image, so nothing is stretched
        const shareScale = Math.min(SHARE_IMAGE_WIDTH / rect.width, SHARE_IMAGE_HEIGHT / rect.height);
        const { data: photo } = await browser.send<{ data: string }>('Page.captureScreenshot', {
            format: 'png',
            clip: { ...rect, scale: shareScale },
        });
        pictures.push({ id, ...await drawShareImage({ browser, photo, dir: join(dir, 'start'), kind: 'png-if-small' }) });
    }
    for (const picture of pictures) savePicture(picture);

    if (ids.includes(ARCADE_ID)) {
        // The wall as it first shows, still, with every photo in view loaded
        await browser.send('Emulation.setDeviceMetricsOverride', {
            width: SHARE_IMAGE_WIDTH,
            height: SHARE_IMAGE_HEIGHT,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await browser.navigate(`${baseUrl}arcade/`);
        await browser.evaluate(WAIT_FOR_WALL);
        const { data: photo } = await browser.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
        savePicture({ id: ARCADE_ID, ...await drawShareImage({ browser, photo, dir: join(arcadeDir, 'src', 'arcade'), kind: 'jpeg' }) });
    }
}
finally {
    await browser.close();
    await server?.close();
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A picture to save. */
interface Picture {
    /** The entry's id, or `arcade`. */
    readonly id: string;
    readonly file: string;
    readonly bytes: Buffer;
    /** Its width and height, as `600x504`. */
    readonly size: string;
}

/**
 * Draws `photo`, a PNG no larger than a share image, as the share image for
 * `dir`, centred on the background. `png-if-small` makes it a PNG, or a JPEG
 * if the PNG is over the budget.
 */
async function drawShareImage(options: {
    browser: HeadlessChrome;
    photo: string;
    dir: string;
    kind: 'png-if-small' | 'jpeg';
}): Promise<Omit<Picture, 'id'>> {
    const { browser, photo, dir, kind } = options;
    // The page draws the picture, since it has the encoders
    const { png, jpeg } = await browser.evaluate<{ png: string; jpeg: string }>(`(async () => {
        const photo = await createImageBitmap(await (await fetch('data:image/png;base64,${photo}')).blob());
        const canvas = document.createElement('canvas');
        canvas.width = ${SHARE_IMAGE_WIDTH};
        canvas.height = ${SHARE_IMAGE_HEIGHT};
        const context = canvas.getContext('2d');
        context.fillStyle = '${SHARE_IMAGE_BACKGROUND}';
        context.fillRect(0, 0, canvas.width, canvas.height);
        // At whole pixels, unscaled, so nothing is smoothed
        context.drawImage(photo, Math.round((canvas.width - photo.width) / 2), Math.round((canvas.height - photo.height) / 2));
        return { png: canvas.toDataURL('image/png'), jpeg: canvas.toDataURL('image/jpeg', ${JPEG_QUALITY}) };
    })()`);
    const pngBytes = Buffer.from(png.slice(png.indexOf(',') + 1), 'base64');
    const isPng = kind === 'png-if-small' && pngBytes.length <= SHARE_IMAGE_MAX_BYTES;
    const bytes = isPng ? pngBytes : Buffer.from(jpeg.slice(jpeg.indexOf(',') + 1), 'base64');
    return { file: join(dir, isPng ? 'share.png' : 'share.jpg'), bytes, size: `${SHARE_IMAGE_WIDTH}x${SHARE_IMAGE_HEIGHT}` };
}

/** Writes `picture`. A share image replaces one of the other kind. */
function savePicture(picture: Picture): void {
    const { id, file, bytes, size } = picture;
    const isShareImage = (SHARE_IMAGE_NAMES as readonly string[]).includes(basename(file));
    if (isShareImage) {
        for (const name of SHARE_IMAGE_NAMES) rmSync(join(dirname(file), name), { force: true });
    }
    writeFileSync(file, bytes);
    const kb = `${Math.round(bytes.length / 1000)} KB`;
    console.log(`${id.padEnd(18)} ${size.padEnd(10)} -> ${relative(arcadeDir, file)} (${kb})`);
    if (isShareImage && bytes.length > SHARE_IMAGE_MAX_BYTES) {
        console.warn(`  ${kb} is over the ${SHARE_IMAGE_MAX_BYTES / 1000} KB that WhatsApp shows`);
    }
}

/** Whether `url` answers, as the dev server does. */
async function isServing(url: string): Promise<boolean> {
    try {
        return (await fetch(url)).ok;
    }
    catch {
        return false;
    }
}
