/**
 * Photographs every entry for its card in the arcade.
 *
 * Usage:  npm run generate-thumbnails [-- <id> ...]
 *
 * Starts the dev server and one headless Chrome, opens the snapshot page
 * (`snapshot.html`, `src/snapshot.ts`) once for each entry, and saves what it
 * shows as `thumbnail.webp` in the entry's directory: the whole play area, at
 * the size that makes the longer side of the entry's crop (`thumbnailCrop`,
 * the part its card shows) CROP_PIXELS long. The images are committed, like the textures:
 * rerun this when an entry changes how it looks, or its crop. Give ids to
 * photograph only those entries.
 */

import { writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createServer } from 'vite';
import { findEntryDirectories } from './entry-facts';
import { launchHeadlessChrome } from './headless-chrome';

/** A card's photo at its largest, at twice the density of a typical card's width in CSS pixels. */
const CROP_PIXELS = 600;
const WEBP_QUALITY = 82;

const websiteDir = resolve(import.meta.dirname, '..');
const entryDirs = findEntryDirectories(join(websiteDir, 'src'));

const server = await createServer({
    configFile: join(websiteDir, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: 5190, strictPort: false },
    logLevel: 'warn',
});
await server.listen();
const baseUrl = server.resolvedUrls?.local[0];
if (baseUrl === undefined) throw new Error('The dev server has no local URL');

const browser = await launchHeadlessChrome();
try {
    await browser.navigate(`${baseUrl}snapshot.html`);
    const { entries } = await browser.evaluate<{
        entries: { id: string; width: number; height: number; cropWidth: number; cropHeight: number }[];
    }>(
        'window.snapshot',
    );
    const requested = process.argv.slice(2);
    const ids = requested.length > 0 ? requested : entries.map((entry) => entry.id);

    for (const id of ids) {
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
        const file = join(dir, 'thumbnail.webp');
        writeFileSync(file, Buffer.from(data, 'base64'));
        const size = `${Math.round(rect.width * scale)}x${Math.round(rect.height * scale)}`;
        console.log(`${id.padEnd(18)} ${size.padEnd(10)} -> ${relative(websiteDir, file)}`);
    }
}
finally {
    await browser.close();
    await server.close();
}
