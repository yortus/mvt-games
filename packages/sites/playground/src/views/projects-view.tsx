/** @jsxImportSource @mvtjs/html */
import { List } from '@mvtjs/html';
import { createComputed, createReaction } from '@mvtjs/utils';
import type { ProjectSummary } from '../models';
import type { RendererKind } from '../project-api';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface ProjectsViewBindings {
    readonly isOpen: () => boolean;
    /** The projects kept in this browser, the one saved last first. */
    readonly projects: () => readonly ProjectSummary[];
    /** The id of the project open, which cannot be deleted. */
    readonly openId: () => string | undefined;
    /** Whether the browser keeps the projects for the next visit. */
    readonly isKept: () => boolean;
    /** The starting projects New offers, one for each renderer. */
    readonly starters: readonly { readonly renderer: RendererKind; readonly name: string; readonly description: string }[];
    /** The examples to offer, by id and name. */
    readonly examples: readonly { readonly id: string; readonly name: string }[];
    readonly onNewPressed?: (renderer: RendererKind) => void;
    readonly onExampleChosen?: (id: string) => void;
    readonly onOpenPressed?: (id: string) => void;
    readonly onDuplicatePressed?: (id: string) => void;
    readonly onDeletePressed?: (id: string) => void;
    readonly onClosed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * A dialog of the projects kept in this browser: a menu that makes a new
 * one, for a renderer, a menu that opens an example, and each kept one, to
 * open, duplicate or delete. Escape, or a
 * press outside the dialog, closes it.
 */
export function ProjectsView(bindings: ProjectsViewBindings): Element {
    /** Whether the dialog has opened since it last took the focus. */
    let isFocusDue = false;
    const queueFocusWhenOpened = createReaction({
        watch: bindings.isOpen,
        when: true,
        react: () => {
            isFocusDue = true;
        },
    });

    return (
        // The wrapper is never hidden, so it sees the dialog close and open again
        <div class="projects-layer" onRefresh={queueFocusWhenOpened}>
            <div class="projects" visible={bindings.isOpen} onPointerDown={onBackdropPressed} onKeyDown={onKeyDown}>
                <div class="projects-panel" role="dialog" aria-modal="true" aria-label="Projects" onRefresh={focusIfDue}>
                    <div class="projects-head">
                        <h2 class="projects-title" text="Projects" />
                        <button type="button" class="projects-close" text="Close" onClick={() => bindings.onClosed?.()} />
                    </div>
                    <div class="projects-new">
                        <select class="projects-new-menu" aria-label="New project" value={() => ''} onChange={onNewChosen}>
                            <option value="" text="New project..." />
                            {bindings.starters.map((starter) => <option value={starter.renderer} title={starter.description} text={`${starter.name} project`} />)}
                        </select>
                        <select class="projects-example-menu" aria-label="Open an example" value={() => ''} onChange={onExampleChosen}>
                            <option value="" text="Open an example..." />
                            {bindings.examples.map((example) => <option value={example.id} text={example.name} />)}
                        </select>
                    </div>
                    <p
                        class="projects-note"
                        visible={() => !bindings.isKept()}
                        text="This browser keeps nothing for this site, so projects last only until the page closes. Export one to keep it."
                    />
                    <p class="projects-none" visible={() => bindings.projects().length === 0} text="No projects yet. Change an example, or make a new project, and it is kept here." />
                    <ul class="projects-list">
                        <List items={bindings.projects}>
                            {(project) => {
                                const isOpen = (): boolean => project().id === bindings.openId();
                                const details = createComputed({
                                    watch: () => project().savedAt,
                                    compute: (savedAt) => describe(project().fileCount, savedAt),
                                });
                                return (
                                    <li class={() => (isOpen() ? 'project project-current' : 'project')}>
                                        <button type="button" class="project-open" onClick={() => bindings.onOpenPressed?.(project().id)}>
                                            <span class="project-name" text={() => project().name} />
                                            <span class="project-description" visible={() => project().description !== ''} text={() => project().description} />
                                            <span class="project-details" text={details} />
                                        </button>
                                        <button type="button" class="project-action" text="Duplicate" onClick={() => bindings.onDuplicatePressed?.(project().id)} />
                                        <button
                                            type="button"
                                            class="project-action"
                                            text="Delete"
                                            title="Delete this project"
                                            disabled={isOpen}
                                            onClick={() => bindings.onDeletePressed?.(project().id)}
                                        />
                                    </li>
                                );
                            }}
                        </List>
                    </ul>
                </div>
            </div>
        </div>
    );

    /** Focuses the dialog once it shows, so Escape closes it. A hidden element cannot take the focus. */
    function focusIfDue(panel: Element): void {
        if (!isFocusDue) return;
        isFocusDue = false;
        panel.querySelector<HTMLElement>('.projects-new-menu')?.focus();
    }

    function onNewChosen(event: Event): void {
        const renderer = (event.target as HTMLSelectElement).value;
        const starter = bindings.starters.find((s) => s.renderer === renderer);
        if (starter !== undefined) bindings.onNewPressed?.(starter.renderer);
    }

    function onExampleChosen(event: Event): void {
        const id = (event.target as HTMLSelectElement).value;
        if (id !== '') bindings.onExampleChosen?.(id);
    }

    function onKeyDown(event: KeyboardEvent): void {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        bindings.onClosed?.();
    }

    function onBackdropPressed(event: PointerEvent): void {
        if (event.target === event.currentTarget) bindings.onClosed?.();
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** A project's details, as its row shows them: "3 files, saved 16 Oct 2026, 5:40 pm". */
function describe(fileCount: number, savedAt: number): string {
    const when = new Date(savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    return `${fileCount} ${fileCount === 1 ? 'file' : 'files'}, saved ${when}`;
}
