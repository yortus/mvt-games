import { describe, expect, it } from 'vitest';
import { isProjectNameTaken, toUniqueProjectName } from './project-names';

describe('project names', () => {
    it('keep a free name as it is', () => {
        expect(toUniqueProjectName('Clock', ['Ball'])).toBe('Clock');
    });

    it('add the first free number from 2 to a taken name, whatever its case', () => {
        expect(toUniqueProjectName('New Pixi project', ['new pixi project'])).toBe('New Pixi project 2');
        expect(toUniqueProjectName('New Pixi project', ['New Pixi project', 'New Pixi project 2'])).toBe('New Pixi project 3');
    });

    it('count on from a number the name ends in', () => {
        expect(toUniqueProjectName('Clock 2', ['Clock', 'Clock 2'])).toBe('Clock 3');
    });

    it('say whether a name is taken, whatever its case and spaces', () => {
        expect(isProjectNameTaken(' clock ', ['Clock'])).toBe(true);
        expect(isProjectNameTaken('Clock 2', ['Clock'])).toBe(false);
    });
});
