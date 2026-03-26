// ---------------------------------------------------------------------------
// Editor panel - CodeMirror 6 based TypeScript editors for model and view
// ---------------------------------------------------------------------------

import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { indentWithTab } from '@codemirror/commands';
import { keymap } from '@codemirror/view';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface EditorPanel {
    /** Mount editor tabs into the given container element. */
    mount(container: HTMLElement): void;

    /** Get the current model source code. */
    getModelCode(): string;

    /** Get the current view source code. */
    getViewCode(): string;

    /** Set the model source code. */
    setModelCode(code: string): void;

    /** Set the view source code. */
    setViewCode(code: string): void;

    /** Register a callback invoked when either editor's content changes. */
    onChange(handler: () => void): void;

    /** Get the active tab ('model' or 'view'). */
    getActiveTab(): 'model' | 'view';

    /** Set the active tab. */
    setActiveTab(tab: 'model' | 'view'): void;

    /** Destroy both editor instances. */
    destroy(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEditorPanel(): EditorPanel {
    let modelEditor: EditorView | undefined;
    let viewEditor: EditorView | undefined;
    let containerEl: HTMLElement | undefined;
    let activeTab: 'model' | 'view' = 'model';
    const changeHandlers: Set<() => void> = new Set();

    // Tab elements
    let tabBar: HTMLElement | undefined;
    let modelTab: HTMLElement | undefined;
    let viewTab: HTMLElement | undefined;
    let modelEditorContainer: HTMLElement | undefined;
    let viewEditorContainer: HTMLElement | undefined;
    let globalsHint: HTMLElement | undefined;

    function notifyChange(): void {
        for (const handler of changeHandlers) {
            handler();
        }
    }

    function createEditorView(parent: HTMLElement, initialCode: string): EditorView {
        const state = EditorState.create({
            doc: initialCode,
            extensions: [
                basicSetup,
                keymap.of([indentWithTab]),
                indentUnit.of('    '),
                EditorState.tabSize.of(4),
                javascript({ typescript: true }),
                oneDark,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        notifyChange();
                    }
                }),
                EditorView.theme({
                    '&': {
                        height: '100%',
                        fontSize: '13px',
                    },
                    '.cm-scroller': {
                        overflow: 'auto',
                        fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
                    },
                    '.cm-content': {
                        minHeight: '100%',
                    },
                }),
            ],
        });

        return new EditorView({ state, parent });
    }

    function updateTabVisibility(): void {
        if (!modelEditorContainer || !viewEditorContainer || !modelTab || !viewTab) return;

        if (activeTab === 'model') {
            modelEditorContainer.style.display = 'block';
            viewEditorContainer.style.display = 'none';
            modelTab.classList.add('active');
            viewTab.classList.remove('active');
        }
        else {
            modelEditorContainer.style.display = 'none';
            viewEditorContainer.style.display = 'block';
            modelTab.classList.remove('active');
            viewTab.classList.add('active');
        }
    }

    function buildDOM(container: HTMLElement): void {
        // Globals hint banner
        globalsHint = document.createElement('div');
        globalsHint.className = 'pg-editor-globals';
        globalsHint.textContent = 'Available: Container, Graphics, Text, Sprite, Texture, Rectangle, TextStyle, watch, setBackground';
        container.appendChild(globalsHint);

        // Tab bar
        tabBar = document.createElement('div');
        tabBar.className = 'pg-editor-tabs';

        modelTab = document.createElement('button');
        modelTab.className = 'pg-editor-tab active';
        modelTab.textContent = 'Model';
        modelTab.addEventListener('click', () => {
            activeTab = 'model';
            updateTabVisibility();
        });

        viewTab = document.createElement('button');
        viewTab.className = 'pg-editor-tab';
        viewTab.textContent = 'View';
        viewTab.addEventListener('click', () => {
            activeTab = 'view';
            updateTabVisibility();
        });

        tabBar.appendChild(modelTab);
        tabBar.appendChild(viewTab);
        container.appendChild(tabBar);

        // Editor containers
        const editorWrapper = document.createElement('div');
        editorWrapper.className = 'pg-editor-wrapper';

        modelEditorContainer = document.createElement('div');
        modelEditorContainer.className = 'pg-editor-cm';
        modelEditorContainer.style.display = 'block';

        viewEditorContainer = document.createElement('div');
        viewEditorContainer.className = 'pg-editor-cm';
        viewEditorContainer.style.display = 'none';

        editorWrapper.appendChild(modelEditorContainer);
        editorWrapper.appendChild(viewEditorContainer);
        container.appendChild(editorWrapper);
    }

    const panel: EditorPanel = {
        mount(container) {
            containerEl = container;
            buildDOM(container);

            modelEditor = createEditorView(modelEditorContainer!, '');
            viewEditor = createEditorView(viewEditorContainer!, '');
        },

        getModelCode() {
            return modelEditor?.state.doc.toString() ?? '';
        },

        getViewCode() {
            return viewEditor?.state.doc.toString() ?? '';
        },

        setModelCode(code) {
            if (!modelEditor) return;
            modelEditor.dispatch({
                changes: {
                    from: 0,
                    to: modelEditor.state.doc.length,
                    insert: code,
                },
            });
        },

        setViewCode(code) {
            if (!viewEditor) return;
            viewEditor.dispatch({
                changes: {
                    from: 0,
                    to: viewEditor.state.doc.length,
                    insert: code,
                },
            });
        },

        onChange(handler) {
            changeHandlers.add(handler);
        },

        getActiveTab() {
            return activeTab;
        },

        setActiveTab(tab) {
            activeTab = tab;
            updateTabVisibility();
        },

        destroy() {
            modelEditor?.destroy();
            viewEditor?.destroy();
            modelEditor = undefined;
            viewEditor = undefined;
            if (containerEl) {
                containerEl.innerHTML = '';
            }
        },
    };

    return panel;
}
