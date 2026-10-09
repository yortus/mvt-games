import type { Audio80, Audio80WithControls, AudioControls } from '@mvtjs/audio';
import { type ChipLog, createHeadlessAudio80 } from '@mvtjs/audio/headless';

// The runner's tests fake the browser's audio with this file. A test file
// mocks the chip's code with it, as below. Then the file calls
// `installFakeWebAudio` before each test, and `uninstallFakeWebAudio` after
// each one.
//
//     vi.mock('@mvtjs/audio/web', async () => (await import('./fake-web-audio')).importFakeWebAudio());
//
// Vitest keeps the mocked module once it has loaded. A test that needs the
// import to run again, such as one that makes it fail, calls `vi.doMock` in
// the same way.

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/** The fake browser's audio, as a test sees and steers it. */
export interface FakeWebAudio {
    /**
     * The browser's chips are faked. Each is a headless chip that logs its
     * writes. They are made in order, the entries' chip first and then the
     * page's.
     */
    readonly chips: readonly FakeChip[];
    /** The audio contexts made, in order. */
    readonly contexts: readonly FakeAudioContext[];
    /** The state each new context starts in. Defaults to `'running'`. */
    initialState: string;
    /** Whether the next import of the chip's code fails, as when its download fails. */
    failsNextImport: boolean;
}

/** A fake browser chip, which logs its writes and counts the calls to its controls that a headless chip ignores. */
export interface FakeChip {
    readonly audio80: Audio80 & ChipLog;
    readonly controls: AudioControls;
    /** How many times `AudioControls.flush` has been called. */
    readonly flushCount: number;
    /** How many times `AudioControls.reset` has been called. */
    readonly resetCount: number;
}

/** A fake audio context. Its state changes only when the test sets it, or when a gesture resumes it. */
export interface FakeAudioContext {
    readonly state: string;
    /** How many times `resume` has been called. */
    readonly resumeCount: number;
    /** Sets the state and tells the listeners, as a browser does when it suspends or interrupts a context. */
    setState: (state: string) => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** How to install the fake. */
export interface FakeWebAudioOptions {
    /** Whether the page is secure, so it can run an `AudioWorklet`. Defaults to true. */
    readonly isSecure?: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Resets the fake, and puts a fake `AudioContext` in place of the browser's.
 * Returns the fake.
 */
export function installFakeWebAudio(options?: FakeWebAudioOptions): FakeWebAudio {
    const fake = findFakeState();
    fake.chips.length = 0;
    fake.contexts.length = 0;
    fake.initialState = 'running';
    fake.failsNextImport = false;
    const isSecure = options?.isSecure ?? true;
    stubGlobal('isSecureContext', isSecure);
    // Only a secure page has `AudioWorkletNode`
    stubGlobal('AudioWorkletNode', isSecure ? function AudioWorkletNode() {} : undefined);
    stubGlobal('AudioContext', function AudioContext() {
        const context = createFakeAudioContext({ state: fake.initialState });
        fake.contexts.push(context);
        return context;
    });
    return fake;
}

/** Puts back the globals that `installFakeWebAudio` replaced. */
export function uninstallFakeWebAudio(): void {
    for (const [name, descriptor] of SAVED_GLOBALS) {
        if (descriptor === undefined) Reflect.deleteProperty(globalThis, name);
        else Object.defineProperty(globalThis, name, descriptor);
    }
    SAVED_GLOBALS.clear();
}

/** Returns the fake chip's code, in place of `@mvtjs/audio/web`. Throws if the test asked the import to fail. */
export function importFakeWebAudio(): { createWebAudio80: (options: { readonly context: unknown }) => Audio80WithControls } {
    const fake = findFakeState();
    if (fake.failsNextImport) {
        fake.failsNextImport = false;
        throw new Error('The fake download failed.');
    }
    return { createWebAudio80: () => createFakeChip({ fake }) };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** The fake's state, with lists that the fake adds to. */
interface MutableFakeWebAudio extends FakeWebAudio {
    readonly chips: FakeChip[];
    readonly contexts: FakeAudioContext[];
}

/**
 * Returns the fake's state, which is kept on the global object. Vitest may
 * load this file twice in a test file, once for the test and once for the
 * mock. Both copies must see the same state.
 */
function findFakeState(): MutableFakeWebAudio {
    const holder = globalThis as { [STATE_KEY]?: MutableFakeWebAudio };
    holder[STATE_KEY] ??= { chips: [], contexts: [], initialState: 'running', failsNextImport: false };
    return holder[STATE_KEY];
}

const STATE_KEY = Symbol.for('mvt-games.fake-web-audio');

/** The globals replaced, with what they were, so they can be put back. */
const SAVED_GLOBALS = new Map<string, PropertyDescriptor | undefined>();

/** Replaces a global, and keeps what it was the first time, for `uninstallFakeWebAudio`. */
function stubGlobal(name: string, value: unknown): void {
    if (!SAVED_GLOBALS.has(name)) SAVED_GLOBALS.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

/** Creates a fake browser chip, and adds it to the fake's chips. */
function createFakeChip(options: { readonly fake: MutableFakeWebAudio }): Audio80WithControls {
    const { fake } = options;
    const chip = createHeadlessAudio80({ record: true });
    let flushCount = 0;
    let resetCount = 0;
    // A headless chip's `flush` and `reset` do nothing, so they are replaced with counters
    chip.controls.flush = () => {
        flushCount++;
    };
    chip.controls.reset = () => {
        resetCount++;
    };
    fake.chips.push({
        audio80: chip.audio80,
        controls: chip.controls,
        get flushCount() {
            return flushCount;
        },
        get resetCount() {
            return resetCount;
        },
    });
    return chip;
}

/** Creates a fake audio context, which starts in `options.state`. */
function createFakeAudioContext(options: { readonly state: string }): FakeAudioContext {
    const events = new EventTarget();
    let state = options.state;
    let resumeCount = 0;
    const context = {
        get state() {
            return state;
        },
        get resumeCount() {
            return resumeCount;
        },
        setState(next: string) {
            state = next;
            events.dispatchEvent(new Event('statechange'));
        },
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        resume() {
            resumeCount++;
            if (state !== 'closed') context.setState('running');
            return Promise.resolve();
        },
        close() {
            context.setState('closed');
            return Promise.resolve();
        },
    };
    return context;
}
