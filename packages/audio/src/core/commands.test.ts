import { describe, expect, it } from 'vitest';
import {
    ECHO_SETTING_INDEX,
    ECHO_SETTINGS,
    FILTER_SETTING_INDEX,
    FILTER_SETTINGS,
    VOICE_SETTING_INDEX,
    VOICE_SETTINGS,
} from './commands';

describe('command setting indices', () => {
    const tables = [
        ['voice', VOICE_SETTING_INDEX, VOICE_SETTINGS],
        ['filter', FILTER_SETTING_INDEX, FILTER_SETTINGS],
        ['echo', ECHO_SETTING_INDEX, ECHO_SETTINGS],
    ] as const;

    for (const [kind, indices, names] of tables) {
        it(`numbers the ${kind} settings from 0 up, each once, and lists each at its number`, () => {
            const entries = Object.entries(indices);
            expect(names).toHaveLength(entries.length);
            for (const [name, index] of entries) expect(names[index]).toBe(name);
        });
    }
});
