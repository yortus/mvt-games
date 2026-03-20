/**
 * Vite plugin that packs per-game texture PNGs into Pixi.js-compatible
 * spritesheet atlases (JSON + PNG) at build time.
 *
 * During **dev** the packed sheets are served via middleware.
 * During **build** they are emitted as assets in `generateBundle`.
 *
 * Texture asset source directories: `src/games/<name>/assets/*.png`
 * Output paths served/emitted: `/assets/<name>-textures.json` and
 * `/assets/<name>-textures.png` - referenced from game code via
 * `Assets.load('/assets/<name>-textures.json')`.
 */

import { type Plugin, type ResolvedConfig } from 'vite';
import { PNG } from 'pngjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PackedFrame {
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface PackedSheet {
    jsonString: string;
    pngBuffer: Buffer;
}

// ---------------------------------------------------------------------------
// Simple grid packer
// ---------------------------------------------------------------------------

function packSprites(dir: string, gameName: string): PackedSheet | null {
    const files = readdirSync(dir)
        .filter((f) => extname(f).toLowerCase() === '.png')
        .sort();

    if (files.length === 0) return null;

    // Decode all source PNGs
    const images: { name: string; png: PNG }[] = [];
    for (const file of files) {
        const buf = readFileSync(join(dir, file));
        const png = PNG.sync.read(buf);
        images.push({ name: basename(file, '.png'), png });
    }

    // Compute atlas size - simple row layout (all textures in one row)
    const padding = 1;
    let atlasWidth = 0;
    let atlasHeight = 0;
    const frames: PackedFrame[] = [];

    for (const img of images) {
        frames.push({
            name: img.name,
            x: atlasWidth,
            y: 0,
            w: img.png.width,
            h: img.png.height,
        });
        atlasWidth += img.png.width + padding;
        atlasHeight = Math.max(atlasHeight, img.png.height);
    }

    // Remove trailing padding
    atlasWidth = Math.max(1, atlasWidth - padding);

    // Round up to power of two for GPU efficiency
    atlasWidth = nextPow2(atlasWidth);
    atlasHeight = nextPow2(atlasHeight);

    // Blit textures into atlas
    const atlas = new PNG({ width: atlasWidth, height: atlasHeight });

    for (let i = 0; i < images.length; i++) {
        const src = images[i].png;
        const frame = frames[i];
        for (let y = 0; y < src.height; y++) {
            for (let x = 0; x < src.width; x++) {
                const si = (y * src.width + x) * 4;
                const di = ((y + frame.y) * atlasWidth + (x + frame.x)) * 4;
                atlas.data[di] = src.data[si];
                atlas.data[di + 1] = src.data[si + 1];
                atlas.data[di + 2] = src.data[si + 2];
                atlas.data[di + 3] = src.data[si + 3];
            }
        }
    }

    const pngBuffer = PNG.sync.write(atlas);

    // Build Pixi.js-compatible JSON
    const framesObj: Record<string, object> = {};
    for (const f of frames) {
        framesObj[f.name] = {
            frame: { x: f.x, y: f.y, w: f.w, h: f.h },
            sourceSize: { w: f.w, h: f.h },
            spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
            trimmed: false,
            rotated: false,
        };
    }

    const json = {
        frames: framesObj,
        meta: {
            image: `${gameName}-textures.png`,
            format: 'RGBA8888',
            size: { w: atlasWidth, h: atlasHeight },
            scale: '1',
        },
    };

    return { jsonString: JSON.stringify(json), pngBuffer };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextPow2(v: number): number {
    let p = 1;
    while (p < v) p <<= 1;
    return p;
}

function discoverGameTextureDirs(root: string): { gameName: string; dir: string }[] {
    const gamesDir = resolve(root, 'src', 'games');
    const results: { gameName: string; dir: string }[] = [];

    let entries: string[];
    try {
        entries = readdirSync(gamesDir);
    } catch {
        return results;
    }

    for (const entry of entries) {
        const assetsDir = join(gamesDir, entry, 'assets');
        try {
            if (statSync(assetsDir).isDirectory()) {
                results.push({ gameName: entry, dir: assetsDir });
            }
        } catch {
            // no assets directory - skip
        }
    }

    return results;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function spritesheetPlugin(): Plugin {
    let config: ResolvedConfig;
    const sheets = new Map<string, PackedSheet>();

    function buildSheets(): void {
        sheets.clear();
        const dirs = discoverGameTextureDirs(config.root);
        for (const { gameName, dir } of dirs) {
            const packed = packSprites(dir, gameName);
            if (packed) {
                sheets.set(gameName, packed);
            }
        }
    }

    return {
        name: 'vite-plugin-spritesheet',
        enforce: 'pre',

        configResolved(resolved) {
            config = resolved;
        },

        // Dev server - pack on startup and serve via middleware
        configureServer(server) {
            buildSheets();

            // Watch texture source directories for changes
            const dirs = discoverGameTextureDirs(config.root);
            for (const { dir } of dirs) {
                server.watcher.add(dir);
            }
            server.watcher.on('change', (path) => {
                if (path.includes('assets') && path.endsWith('.png')) {
                    buildSheets();
                }
            });
            server.watcher.on('add', (path) => {
                if (path.includes('assets') && path.endsWith('.png')) {
                    buildSheets();
                }
            });

            server.middlewares.use((req, res, next) => {
                const url = req.url ?? '';
                const match = url.match(/^\/assets\/([a-z0-9-]+)-textures\.(json|png)$/);
                if (!match) return next();

                const gameName = match[1];
                const ext = match[2];
                const sheet = sheets.get(gameName);
                if (!sheet) return next();

                if (ext === 'json') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(sheet.jsonString);
                } else {
                    res.setHeader('Content-Type', 'image/png');
                    res.end(sheet.pngBuffer);
                }
            });
        },

        // Production build - pack and emit
        generateBundle() {
            buildSheets();

            for (const [gameName, sheet] of sheets) {
                this.emitFile({
                    type: 'asset',
                    fileName: `assets/${gameName}-textures.json`,
                    source: sheet.jsonString,
                });
                this.emitFile({
                    type: 'asset',
                    fileName: `assets/${gameName}-textures.png`,
                    source: sheet.pngBuffer,
                });
            }
        },
    };
}
