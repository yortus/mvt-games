/**
 * The visual tests' two Vitest projects: `visual` (Pixi and three.js views,
 * every file in one shared page) and `visual-html` (HTML views, a page per
 * file, since each file brings its own stylesheet). Both run in Playwright's
 * headless shell, launched with everything that differs between machines
 * pinned.
 */

import { playwright } from '@vitest/browser-playwright';
import type { TestProjectInlineConfiguration } from 'vitest/config';
import type { VisualKind } from '../../src/testing';
import { visualCommands } from './commands';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VisualProjectOptions {
    readonly kind: VisualKind;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

export function visualProject(options: VisualProjectOptions): TestProjectInlineConfiguration {
    const isHtml = options.kind === 'html';
    return {
        extends: './vite.config.ts',
        // One page runs many files, so a dependency found mid-run must not be
        // re-bundled: the files after it would load a second copy of Pixi,
        // whose objects (Texture.WHITE) are not the first's
        optimizeDeps: {
            include: ['pixi.js', 'three', 'three/addons/environments/RoomEnvironment.js', 'gsap', 'fontkit'],
        },
        test: {
            name: isHtml ? 'visual-html' : 'visual',
            include: isHtml ? ['src/**/*.html.visual.tsx'] : ['src/**/*.visual.tsx'],
            exclude: isHtml ? [] : ['src/**/*.html.visual.tsx'],
            // HTML views' stylesheets stay in the page once imported: a fresh page per file
            isolate: isHtml,
            fileParallelism: false,
            setupFiles: ['src/testing/setup.ts'],
            testTimeout: 30_000,
            provide: { visualKind: options.kind },
            browser: {
                enabled: true,
                headless: true,
                screenshotFailures: false,
                dependencySourcemaps: false,
                viewport: { width: 1280, height: 800 },
                provider: playwright({
                    launchOptions: { args: BROWSER_ARGS },
                    contextOptions: { locale: 'en-US', timezoneId: 'UTC', deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' },
                }),
                instances: [{ browser: 'chromium' }],
                commands: visualCommands,
            },
        },
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Everything that would differ between machines, pinned inside the browser. */
const BROWSER_ARGS = [
    // WebGL on the CPU (SwiftShader), the same code on every system
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    // 2D drawing and compositing on the CPU too: macOS composites
    // transformed boxes its own way otherwise
    '--disable-accelerated-2d-canvas',
    '--disable-gpu-rasterization',
    '--disable-gpu',
    '--disable-gpu-compositing',
    // Text: grayscale antialiasing, and hinting off, so Linux keeps each
    // advance's fraction as Windows and macOS do
    '--disable-lcd-text',
    '--font-render-hinting=none',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
];
