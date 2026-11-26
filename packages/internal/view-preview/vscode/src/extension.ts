// The VS Code extension for the view preview. It puts a Preview lens above
// each visual test in a test file. Following one starts the preview's server
// for the test's package, if it isn't running, and shows the preview page in
// a tab beside the editor, with that test picked. A snapshot taken on the
// page comes back here, and the extension adds the test through the editor,
// so it can't overwrite changes you haven't saved.
import { basename } from 'node:path';
import { createSnapshotEdit } from '@mvtjs/view-preview/snapshot-edit';
import * as vscode from 'vscode';
import { createPreviewPanel } from './preview-panel';
import { createPreviewServers } from './preview-servers';
import { findPackageRoot, listPreviewTargets, type PreviewTarget, toPageHash } from './preview-targets';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
    const output = vscode.window.createOutputChannel('MVT View Preview');
    const servers = createPreviewServers({
        output,
        nodePath: () => vscode.workspace.getConfiguration('mvtViewPreview').get<string>('node') ?? 'node',
    });
    const panel = createPreviewPanel({
        onOpenSource: ({ path, line, column }) => {
            const at = new vscode.Position(line - 1, column - 1);
            void vscode.window.showTextDocument(vscode.Uri.file(path), { selection: new vscode.Range(at, at), viewColumn: vscode.ViewColumn.One });
        },
        onSnapshot: async (request) => {
            const uri = vscode.Uri.file(request.file);
            const document = await vscode.workspace.openTextDocument(uri);
            if (document.isDirty) return { kind: 'refused', reason: 'The test file has changes you haven\'t saved. Save it, let the preview reload, and take the snapshot again.' };
            const edit = createSnapshotEdit({ code: document.getText(), request });
            if (edit.kind === 'refused') return edit;
            const change = new vscode.WorkspaceEdit();
            change.insert(uri, document.positionAt(edit.offset), edit.text);
            if (!await vscode.workspace.applyEdit(change) || !await document.save()) return { kind: 'refused', reason: 'VS Code couldn\'t add the test to its file.' };
            const at = new vscode.Position(edit.line - 1, edit.column - 1);
            void vscode.window.showTextDocument(document, { selection: new vscode.Range(at, at), viewColumn: vscode.ViewColumn.One, preserveFocus: true });
            // The page reloads as the file changes, so the extension, not the page, starts the writing of the reference image
            const packageRoot = findPackageRoot(request.file);
            if (packageRoot !== undefined) {
                const address = await servers.ensure(packageRoot);
                const body = JSON.stringify({ file: request.file, name: request.name.trim() });
                fetch(`${address}api/reference`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch((error: unknown) => {
                    output.appendLine(`The preview's server didn't start the reference image: ${String(error)}`);
                });
            }
            return edit;
        },
    });

    const preview = async (target: PreviewTarget): Promise<void> => {
        const packageRoot = findPackageRoot(target.file);
        const hash = packageRoot === undefined ? undefined : toPageHash({ packageRoot, target });
        if (packageRoot === undefined || hash === undefined) {
            void vscode.window.showWarningMessage('The view preview shows the visual tests under a package\'s src/ folder, and this file isn\'t in one.');
            return;
        }
        try {
            const title = basename(packageRoot);
            const address = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Window, title: `Starting the view preview for ${title}` },
                () => servers.ensure(packageRoot),
            );
            await panel.show({ address, hash, title });
        }
        catch (error) {
            output.show(true);
            void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        }
    };

    context.subscriptions.push(
        output,
        { dispose: servers.stopAll },
        { dispose: panel.dispose },
        vscode.languages.registerCodeLensProvider({ pattern: TEST_FILES }, {
            provideCodeLenses: (document) => listPreviewTargets({ code: document.getText(), fileName: document.fileName }).map(({ offset, target }) => {
                const at = document.positionAt(offset);
                return new vscode.CodeLens(new vscode.Range(at, at), { title: '$(play) Preview', command: PREVIEW_TEST, arguments: [target] });
            }),
        }),
        vscode.commands.registerCommand(PREVIEW_TEST, (target: PreviewTarget) => preview(target)),
        vscode.commands.registerCommand(PREVIEW_FILE, () => {
            const file = vscode.window.activeTextEditor?.document.fileName;
            if (file !== undefined) void preview({ file });
        }),
    );
}

export function deactivate(): void {
    // The subscriptions stop the servers and close the tab
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const TEST_FILES = '**/visual-tests/*.test.{ts,tsx}';
const PREVIEW_TEST = 'mvtViewPreview.previewTest';
const PREVIEW_FILE = 'mvtViewPreview.previewFile';
