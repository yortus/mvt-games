// ---------------------------------------------------------------------------
// Console panel - displays forwarded console output and errors
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface ConsolePanel {
    /** Mount into a container element. */
    mount(container: HTMLElement): void;

    /** Append a log entry. */
    log(level: 'log' | 'warn' | 'error', message: string, source?: string): void;

    /** Clear all entries. */
    clear(): void;

    /** Destroy and clean up. */
    destroy(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createConsolePanel(): ConsolePanel {
    let containerEl: HTMLElement | undefined;
    let logContainer: HTMLElement | undefined;
    let clearBtn: HTMLButtonElement | undefined;
    let headerEl: HTMLElement | undefined;
    let collapsed = false;

    function buildDOM(container: HTMLElement): void {
        // Header with title and clear button
        headerEl = document.createElement('div');
        headerEl.className = 'pg-console-header';

        const title = document.createElement('span');
        title.className = 'pg-console-title';
        title.textContent = 'Console';
        title.addEventListener('click', () => {
            collapsed = !collapsed;
            updateCollapsed();
        });
        headerEl.appendChild(title);

        clearBtn = document.createElement('button');
        clearBtn.className = 'pg-btn pg-btn-small';
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', () => {
            if (logContainer) logContainer.innerHTML = '';
        });
        headerEl.appendChild(clearBtn);

        container.appendChild(headerEl);

        // Log container
        logContainer = document.createElement('div');
        logContainer.className = 'pg-console-log';
        container.appendChild(logContainer);
    }

    function updateCollapsed(): void {
        if (!logContainer) return;
        logContainer.style.display = collapsed ? 'none' : 'block';
    }

    const panel: ConsolePanel = {
        mount(container) {
            containerEl = container;
            buildDOM(container);
        },

        log(level, message, source) {
            if (!logContainer) return;
            const entry = document.createElement('div');
            entry.className = `pg-console-entry pg-console-${level}`;

            if (source) {
                const badge = document.createElement('span');
                badge.className = `pg-console-badge pg-console-badge-${source}`;
                badge.textContent = source;
                entry.appendChild(badge);
            }

            const text = document.createElement('span');
            text.textContent = message;
            entry.appendChild(text);

            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        },

        clear() {
            if (logContainer) logContainer.innerHTML = '';
        },

        destroy() {
            if (containerEl) containerEl.innerHTML = '';
            containerEl = undefined;
        },
    };

    return panel;
}
