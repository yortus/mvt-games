import { describe, expect, it } from 'vitest';
import { parseThemeChoice, THEME_CHOICES } from './theme-choice';

describe('parseThemeChoice', () => {
    it('reads back every choice', () => {
        for (const choice of THEME_CHOICES) expect(parseThemeChoice(choice)).toBe(choice);
    });

    it('reads nothing kept, or a theme it does not know, as the default', () => {
        expect(parseThemeChoice(undefined)).toBe('default');
        expect(parseThemeChoice('neon')).toBe('default');
    });
});
