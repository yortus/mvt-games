/** @jsxImportSource @mvtjs/html */
import { watch } from '@mvtjs/utils';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface HeaderViewBindings {
    readonly projectName: () => string;
    /** Rises each time the visitor asks to save, for a moment's note that the project is saved. */
    readonly saves: () => number;
    /** Reported as the cog beside the project's name is pressed, for the project's options. */
    readonly onOptionsPressed?: () => void;
    readonly onProjectsPressed?: () => void;
    readonly onSharePressed?: () => void;
    readonly onExportPressed?: () => void;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

/**
 * The playground's header: Projects, the way to every project, then the
 * project open, its name the page's heading, with a cog for its options, and
 * at the right, Share and Export. The project is saved as it changes, so a
 * request to save only says so: "Saved" shows beside the name for a moment.
 */
export function HeaderView(bindings: HeaderViewBindings): Element {
    const watcher = watch({ saves: bindings.saves });
    watcher.poll();
    let savedNoteMs = 0;

    return (
        <header class="header" onUpdate={update}>
            <button type="button" class="header-projects" text="Projects" onClick={() => bindings.onProjectsPressed?.()} />
            <h1 class="header-project" text={bindings.projectName} />
            <button type="button" class="header-options" title="Project options" aria-label="Project options" text="⚙" onClick={() => bindings.onOptionsPressed?.()} />
            <span class="header-saved" text="Saved" visible={() => savedNoteMs > 0} />
            <button type="button" class="header-share" text="Share" onClick={() => bindings.onSharePressed?.()} />
            <button type="button" class="header-export" text="Export" title="Download the project as a Vite project, to run on your own machine" onClick={() => bindings.onExportPressed?.()} />
        </header>
    );

    function update(deltaMs: number): void {
        if (watcher.poll().saves.increased) savedNoteMs = SAVED_NOTE_MS;
        else savedNoteMs = Math.max(0, savedNoteMs - deltaMs);
    }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** How long "Saved" shows. */
const SAVED_NOTE_MS = 1500;
