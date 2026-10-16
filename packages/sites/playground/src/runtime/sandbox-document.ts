import type { PreparedModule } from './prepare-project';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface SandboxDocumentOptions {
    readonly modules: readonly PreparedModule[];
    /** Where each guarded loop is, as `path:line`. */
    readonly loops: readonly string[];
    /** Each library's specifier, and the URL of its module. */
    readonly libraries: Readonly<Record<string, string>>;
    /** The URL of the module that runs the project. */
    readonly runnerUrl: string;
    /** The name the import map gives a project file. */
    readonly toModuleName: (path: string) => string;
    /** The path of the file the project starts from. */
    readonly mainPath: string;
    /** The colour around the project, as `#rrggbb`: the page's theme's, so the preview matches the page. */
    readonly background: string;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns the HTML a sandbox iframe is given as its `srcdoc`. Its one inline
 * script makes a blob URL for each module, adds an import map that names
 * them and the libraries, sets up the loop guards' check and the reports to
 * the page, and then loads the runner, which runs `main.ts`.
 *
 * A stack trace names a blob URL. Chromium and Firefox name the file
 * instead, from its `sourceURL` comment, but WebKit does not. So the script
 * replaces each blob URL in a stack with its file's path.
 */
export function buildSandboxDocument(options: SandboxDocumentOptions): string {
    const data = {
        modules: options.modules.map((m) => ({ path: m.path, name: options.toModuleName(m.path), code: m.code })),
        loops: options.loops,
        libraries: options.libraries,
        runnerUrl: options.runnerUrl,
        mainModule: options.toModuleName(options.mainPath),
    };
    const background = /^#[0-9a-f]{6}$/i.test(options.background) ? options.background : '#111111';
    // `<` written as an escape, so no file can end the script element early
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return `<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background}}canvas{display:block}</style>
<script type="application/json" id="playground-data">${json}</script>
<script>${BOOTSTRAP}</script>
</head><body></body></html>`;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const BOOTSTRAP = `
(() => {
    const data = JSON.parse(document.getElementById('playground-data').textContent);
    const post = (message) => parent.postMessage(message, '*');
    const imports = { ...data.libraries };
    const pathOfUrl = new Map();
    for (const module of data.modules) {
        const url = URL.createObjectURL(new Blob([module.code], { type: 'text/javascript' }));
        imports[module.name] = url;
        pathOfUrl.set(url, module.path);
    }
    const map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = JSON.stringify({ imports });
    document.head.append(map);

    const describe = (error) => {
        let stack = String((error && error.stack) || '');
        for (const [url, path] of pathOfUrl) stack = stack.split(url).join(path);
        const message = error instanceof Error ? error.message : String(error);
        return { message, stack };
    };

    globalThis.__pgFrameStart = performance.now();
    globalThis.__pgLoopCheck = (id) => {
        if (performance.now() - globalThis.__pgFrameStart > 1000) {
            throw new Error('A loop at ' + data.loops[id] + ' ran for more than a second without a frame. It may never end.');
        }
    };

    addEventListener('error', (event) => post({ kind: 'error', phase: 'outside', ...describe(event.error ?? event.message) }));
    addEventListener('unhandledrejection', (event) => post({ kind: 'error', phase: 'outside', ...describe(event.reason) }));
    for (const level of ['log', 'info', 'warn', 'error']) {
        const write = console[level].bind(console);
        console[level] = (...args) => {
            write(...args);
            post({ kind: 'console', level, text: args.map(toText).join(' ') });
        };
    }
    function toText(value) {
        if (typeof value === 'string') return value;
        if (value instanceof Error) return value.message;
        try {
            return JSON.stringify(value) ?? String(value);
        }
        catch {
            return String(value);
        }
    }

    import(data.runnerUrl).then(
        (runner) => runner.runSandbox({ report: { post, describe }, mainModule: data.mainModule }),
        (error) => post({ kind: 'error', phase: 'load', ...describe(error) }),
    );
})();
`;
