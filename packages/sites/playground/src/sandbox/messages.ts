// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** What the playground's page sends the sandbox, to control the run. */
export type HostMessage =
    | { readonly kind: 'pause' }
    | { readonly kind: 'resume' }
    | { readonly kind: 'step'; readonly deltaMs: number }
    | { readonly kind: 'set-speed'; readonly speed: number }
    /** The colour around the project, as `#rrggbb`, as the page's theme changes. */
    | { readonly kind: 'set-background'; readonly colour: string };

/** When an error happened: loading the project, starting it, in a frame, or outside all three. */
export type ErrorPhase = 'load' | 'start' | 'frame' | 'outside';

/** What the sandbox sends the playground's page, as the run goes. */
export type SandboxMessage =
    /** The project's modules have loaded, and it is starting. */
    | { readonly kind: 'started' }
    /** The project has drawn its first frame. */
    | { readonly kind: 'first-frame' }
    /** Sent twice a second, while the sandbox can run its timers, so the page can tell it has not frozen. */
    | { readonly kind: 'heartbeat' }
    | { readonly kind: 'console'; readonly level: ConsoleLevel; readonly text: string }
    | {
        readonly kind: 'error';
        readonly phase: ErrorPhase;
        readonly message: string;
        /** The stack trace, with each project file's blob URL replaced by its path. */
        readonly stack: string;
    };

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error';
