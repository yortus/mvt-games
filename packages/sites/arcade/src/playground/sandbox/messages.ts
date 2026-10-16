// ---------------------------------------------------------------------------
// Message protocol between playground host and sandbox iframe
// ---------------------------------------------------------------------------

// --- Host -> Sandbox ---

export interface RunMessage {
    readonly kind: 'run';
    readonly modelCode: string;
    readonly viewCode: string;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
}

export interface StopMessage {
    readonly kind: 'stop';
}

export interface SetSpeedMessage {
    readonly kind: 'set-speed';
    readonly speed: number;
}

export interface StepMessage {
    readonly kind: 'step';
    readonly deltaMs: number;
}

export interface ResetMessage {
    readonly kind: 'reset';
    readonly modelCode: string;
    readonly viewCode: string;
    readonly canvasWidth: number;
    readonly canvasHeight: number;
}

export interface PauseMessage {
    readonly kind: 'pause';
}

export interface ResumeMessage {
    readonly kind: 'resume';
}

export interface PingMessage {
    readonly kind: 'ping';
}

export type HostMessage =
    | RunMessage
    | StopMessage
    | SetSpeedMessage
    | StepMessage
    | ResetMessage
    | PauseMessage
    | ResumeMessage
    | PingMessage;

// --- Sandbox -> Host ---

export interface ReadyMessage {
    readonly kind: 'ready';
}

export interface RunningMessage {
    readonly kind: 'running';
}

export interface StoppedMessage {
    readonly kind: 'stopped';
}

export interface ErrorMessage {
    readonly kind: 'error';
    readonly message: string;
    readonly line?: number;
    readonly source: 'model' | 'view' | 'runtime';
}

export interface ConsoleMessage {
    readonly kind: 'console';
    readonly level: 'log' | 'warn' | 'error';
    readonly args: string[];
}

export interface PongMessage {
    readonly kind: 'pong';
}

export type SandboxMessage =
    | ReadyMessage
    | RunningMessage
    | StoppedMessage
    | ErrorMessage
    | ConsoleMessage
    | PongMessage;
