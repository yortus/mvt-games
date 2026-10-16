import { refreshView, updateView } from '@mvtjs/html';
import type { HtmlProject, HtmlStartOptions } from '../project-api';
import type { RendererHost } from './renderer-host';

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Makes an element for the project's views: of the project's size, or
 * filling the sandbox where it names none. The browser draws it, so a frame
 * needs no draw of its own.
 */
export function createHtmlHost(project: HtmlProject): RendererHost<Omit<HtmlStartOptions, 'sound'>> {
    const root = document.createElement('div');
    root.style.position = 'relative';
    root.style.overflow = 'auto';
    root.style.width = project.width === undefined ? '100%' : `${project.width}px`;
    root.style.height = project.height === undefined ? '100%' : `${project.height}px`;
    // Its own background, so its light text reads whatever the page's theme
    root.style.background = `#${(project.background ?? HTML_BACKGROUND).toString(16).padStart(6, '0')}`;
    root.style.color = '#e6e6e6';
    root.style.font = '14px system-ui, sans-serif';
    document.body.append(root);
    return {
        startOptions: { root, width: root.clientWidth, height: root.clientHeight },
        update: (deltaMs) => updateView(root, deltaMs),
        refresh: () => refreshView(root),
        render: () => {},
    };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The colour behind an HTML project that names none: the preview's, before themes. */
const HTML_BACKGROUND = 0x111111;
