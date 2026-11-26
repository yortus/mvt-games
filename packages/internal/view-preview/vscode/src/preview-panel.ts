import { randomBytes } from 'node:crypto';
import type { SnapshotEdit, SnapshotRequest } from '@mvtjs/view-preview/shared';
import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * The editor tab that shows the preview page. It's one tab, whichever
 * package's test you preview, and it holds the page in an iframe. Picking
 * another test of the same package sends the page the test's address, so
 * the page stays loaded. A test of another package loads that package's
 * page.
 */
export interface PreviewPanel {
    readonly show: (options: { readonly address: string; readonly hash: string; readonly title: string }) => Promise<void>;
    readonly dispose: () => void;
}

/** Where a test's pose is, which the page's link to the source sends. */
export interface SourceLocation {
    readonly path: string;
    readonly line: number;
    readonly column: number;
}

export interface PreviewPanelOptions {
    /** Called when you follow the page's link to a test's source. */
    readonly onOpenSource: (source: SourceLocation) => void;
    /** Called when you take a snapshot on the page. It adds the test to its file, and returns the edit it made, or why it refused. */
    readonly onSnapshot: (request: SnapshotRequest) => Promise<SnapshotEdit>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPreviewPanel(options: PreviewPanelOptions): PreviewPanel {
    const { onOpenSource, onSnapshot } = options;
    const state = { panel: undefined as vscode.WebviewPanel | undefined, address: '' };

    const createPanel = (): vscode.WebviewPanel => {
        const panel = vscode.window.createWebviewPanel('mvtViewPreview', 'View Preview', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
            enableScripts: true,
            // The page keeps its renderers and the time it has played while its tab is hidden
            retainContextWhenHidden: true,
        });
        panel.onDidDispose(() => {
            state.panel = undefined;
            state.address = '';
        });
        panel.webview.onDidReceiveMessage((message: PageMessage) => {
            if (message.type === 'view-preview:open-source' && message.path !== undefined) {
                onOpenSource({ path: message.path, line: message.line ?? 1, column: message.column ?? 1 });
            }
            if (message.type === 'view-preview:snapshot' && message.request !== undefined) {
                const { id, request } = message;
                void onSnapshot(request)
                    .catch((error: unknown): SnapshotEdit => ({ kind: 'refused', reason: error instanceof Error ? error.message : String(error) }))
                    .then((edit) => panel.webview.postMessage({ type: 'view-preview:snapshot-result', id, edit }));
            }
        });
        return panel;
    };

    return {
        show: async ({ address, hash, title }) => {
            const external = (await vscode.env.asExternalUri(vscode.Uri.parse(address))).toString(true);
            const panel = state.panel ?? createPanel();
            state.panel = panel;
            panel.title = `View Preview: ${title}`;
            panel.reveal(undefined, true);
            if (state.address === external) {
                await panel.webview.postMessage({ type: 'view-preview:select', hash });
                return;
            }
            state.address = external;
            panel.webview.html = createWebviewHtml({ src: `${external}#${hash}`, origin: new URL(external).origin });
        },
        dispose: () => state.panel?.dispose(),
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A message from the preview page, which the webview passes on. */
interface PageMessage extends Partial<SourceLocation> {
    readonly type?: string;
    readonly id?: number;
    readonly request?: SnapshotRequest;
}

/**
 * Returns the webview's page, which fills the tab with the preview page, in
 * an iframe. Its script passes messages between the extension and the
 * preview page, each way.
 */
function createWebviewHtml(options: { readonly src: string; readonly origin: string }): string {
    const { src, origin } = options;
    const nonce = randomBytes(16).toString('base64');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
<style>html, body, iframe { margin: 0; padding: 0; border: 0; width: 100%; height: 100%; overflow: hidden; display: block; }</style>
</head>
<body>
<iframe id="preview" src="${escapeAttribute(src)}" allow="${LOCAL_NETWORK_FEATURES}"></iframe>
<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById('preview');
    window.addEventListener('message', (event) => {
        // From the preview page, for the extension
        if (event.source === frame.contentWindow) {
            vscode.postMessage(event.data);
            return;
        }
        // From the extension, for the preview page
        frame.contentWindow.postMessage(event.data, ${JSON.stringify(origin)});
    });
</script>
</body>
</html>`;
}

/**
 * Chrome's permission policies for reaching addresses on your own machine,
 * by their old name and their new ones. The preview's server is on
 * `localhost`. Chrome stops a page that it counts as public from loading a
 * `localhost` page in an iframe, unless the policy is passed down to it.
 */
const LOCAL_NETWORK_FEATURES = 'local-network-access; local-network; loopback-network';

function escapeAttribute(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
